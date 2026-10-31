import {
  type DrivingRoute,
  type WalkingRoute,
  calculateDistanceKm,
} from '@smart-parking/shared-types';
import { classifyTraffic } from './traffic-classifier.js';
import { RoutingContext } from './routing-context.js';
import { GoogleRoutesStrategy } from './strategies/google-routes.strategy.js';
import { GeometricFallbackStrategy } from './strategies/geometric-fallback.strategy.js';

// Re-export shared helper and classifier for backwards compatibility with existing consumers
export { calculateDistanceKm, classifyTraffic };
export * from './strategies/index.js';
export { RoutingContext } from './routing-context.js';

// Global singleton context using GoogleRoutesStrategy by default with GeometricFallback
export const defaultRoutingContext = new RoutingContext(
  new GoogleRoutesStrategy(),
  new GeometricFallbackStrategy()
);

/**
 * Calculates driving route from starting position to carpark using the Strategy Pattern (SC2006).
 */
export async function getDrivingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DrivingRoute> {
  return defaultRoutingContext.calculateDrivingRoute({
    originLat,
    originLng,
    destLat,
    destLng,
  });
}

/**
 * Calculates walking route from carpark to final destination venue using the Strategy Pattern (SC2006).
 */
export async function getWalkingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<WalkingRoute> {
  return defaultRoutingContext.calculateWalkingRoute({
    originLat,
    originLng,
    destLat,
    destLng,
  });
}
