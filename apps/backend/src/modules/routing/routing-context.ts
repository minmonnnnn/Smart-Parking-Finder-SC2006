import type { DrivingRoute, WalkingRoute } from '@smart-parking/shared-types';
import type { IRoutingStrategy, RouteCoordinates } from './strategies/routing-strategy.interface.js';
import { GeometricFallbackStrategy } from './strategies/geometric-fallback.strategy.js';
import { GoogleRoutesStrategy } from './strategies/google-routes.strategy.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_CACHE_SIZE = 200;
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function makeRouteKey(oLat: number, oLng: number, dLat: number, dLng: number): string {
  return `${oLat.toFixed(4)},${oLng.toFixed(4)}->${dLat.toFixed(4)},${dLng.toFixed(4)}`;
}

/**
 * Context class in the Strategy Pattern (SC2006).
 * Maintains a reference to the active IRoutingStrategy and manages in-memory caching
 * with automatic fallback degradation when the active strategy encounters external failures.
 */
export class RoutingContext {
  private strategy: IRoutingStrategy;
  private fallbackStrategy: IRoutingStrategy;

  private drivingRouteCache = new Map<string, CacheEntry<DrivingRoute>>();
  private walkingRouteCache = new Map<string, CacheEntry<WalkingRoute>>();

  constructor(
    strategy: IRoutingStrategy = new GoogleRoutesStrategy(),
    fallbackStrategy: IRoutingStrategy = new GeometricFallbackStrategy()
  ) {
    this.strategy = strategy;
    this.fallbackStrategy = fallbackStrategy;
  }

  /**
   * Sets the active routing strategy at runtime (Strategy Pattern).
   * @param strategy The concrete strategy to use
   */
  setStrategy(strategy: IRoutingStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Gets the active routing strategy.
   */
  getStrategy(): IRoutingStrategy {
    return this.strategy;
  }

  /**
   * Clears the in-memory route cache (useful for testing or cache resets).
   */
  clearCache(): void {
    this.drivingRouteCache.clear();
    this.walkingRouteCache.clear();
  }

  private setWithEviction<T>(cache: Map<string, CacheEntry<T>>, key: string, entry: CacheEntry<T>): void {
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(key, entry);
  }

  /**
   * Computes a driving route using the active strategy, falling back to the fallback strategy upon failure.
   */
  async calculateDrivingRoute(coords: RouteCoordinates): Promise<DrivingRoute> {
    const { originLat, originLng, destLat, destLng } = coords;
    const cacheKey = makeRouteKey(originLat, originLng, destLat, destLng);

    const cached = this.drivingRouteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let route: DrivingRoute;
    try {
      route = await this.strategy.computeDrivingRoute(coords);
    } catch {
      // Graceful fallback to the secondary strategy if primary encounters an outage or error
      route = await this.fallbackStrategy.computeDrivingRoute(coords);
    }

    this.setWithEviction(this.drivingRouteCache, cacheKey, {
      data: route,
      expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
    });

    return route;
  }

  /**
   * Computes a walking route using the active strategy, falling back to the fallback strategy upon failure.
   */
  async calculateWalkingRoute(coords: RouteCoordinates): Promise<WalkingRoute> {
    const { originLat, originLng, destLat, destLng } = coords;
    const cacheKey = makeRouteKey(originLat, originLng, destLat, destLng);

    const cached = this.walkingRouteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let route: WalkingRoute;
    try {
      route = await this.strategy.computeWalkingRoute(coords);
    } catch {
      // Graceful fallback to secondary strategy
      route = await this.fallbackStrategy.computeWalkingRoute(coords);
    }

    this.setWithEviction(this.walkingRouteCache, cacheKey, {
      data: route,
      expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
    });

    return route;
  }
}

