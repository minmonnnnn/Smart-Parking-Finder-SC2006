import {
  type DrivingRoute,
  type WalkingRoute,
  type TrafficStatus,
  calculateDistanceKm,
  WALKING_SPEED_M_PER_MIN,
} from '@smart-parking/shared-types';
import { getLtaTrafficIncidents, hasNearbyIncidents } from './lta-traffic.service.js';

// Re-export calculateDistanceKm so existing callers don't break
export { calculateDistanceKm };

/**
 * Classifies traffic conditions using speed thresholds and LTA DataMall incident reports (FR21, FR23).
 */
async function classifyTraffic(
  distanceKm: number,
  durationMinutes: number,
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<TrafficStatus> {
  if (distanceKm <= 0 || durationMinutes <= 0) return 'Light';
  const effectiveSpeedKmh = (distanceKm / durationMinutes) * 60;

  let traffic: TrafficStatus;
  if (effectiveSpeedKmh < 22) {
    traffic = 'Heavy';
  } else if (effectiveSpeedKmh < 38) {
    traffic = 'Moderate';
  } else {
    traffic = 'Light';
  }

  // Cross-reference with real-time LTA DataMall traffic incidents (FR21)
  try {
    const incidents = await getLtaTrafficIncidents();
    if (hasNearbyIncidents(incidents, originLat, originLng, destLat, destLng)) {
      console.log('[LTA Traffic] Active incident detected along route corridor. Escalated traffic condition.');
      if (traffic === 'Light') traffic = 'Moderate';
      else if (traffic === 'Moderate') traffic = 'Heavy';
    }
  } catch {
    // If LTA service is unreachable, keep speed-based status
  }

  return traffic;
}

// Cache to prevent duplicate api calls
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_CACHE_SIZE = 200;
const drivingRouteCache = new Map<string, CacheEntry<DrivingRoute>>();
const walkingRouteCache = new Map<string, CacheEntry<WalkingRoute>>();
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function setWithEviction<T>(cache: Map<string, CacheEntry<T>>, key: string, entry: CacheEntry<T>): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, entry);
}

// Generates a cache key for identical coordinate pairs
function makeRouteKey(oLat: number, oLng: number, dLat: number, dLng: number): string {
  return `${oLat.toFixed(4)},${oLng.toFixed(4)}->${dLat.toFixed(4)},${dLng.toFixed(4)}`;
}

// Retrieve Google Maps API key from env
function getRoutingApiKey(): string {
  const rawKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!rawKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not set');
  }
  return rawKey.split('#')[0]!.trim();
}

interface GoogleRouteItem {
  duration?: string;
  distanceMeters?: number;
  description?: string;
  polyline?: { encodedPolyline?: string };
}

/**
 * Calculates driving route from starting position to carpark.
 */
export async function getDrivingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DrivingRoute> {
  const cacheKey = makeRouteKey(originLat, originLng, destLat, destLng);
  const cached = drivingRouteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const apiKey = getRoutingApiKey();
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'routes.duration,routes.distanceMeters,routes.description,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: 'DRIVE',
        computeAlternativeRoutes: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await response.json()) as { routes?: GoogleRouteItem[]; error?: { message?: string } };

    if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
      const parsedRoutes: DrivingRoute[] = await Promise.all(
        data.routes.map(async (r: GoogleRouteItem) => {
          const rawSeconds = parseInt((r.duration || '0s').replace('s', ''), 10);
          const durationMin = Math.max(1, Math.round(rawSeconds / 60));
          const distMeters = Math.round(r.distanceMeters || 0);
          const distKm = distMeters / 1000;
          const traffic = await classifyTraffic(distKm, durationMin, originLat, originLng, destLat, destLng);

          const routeResult: DrivingRoute = {
            polyline: r.polyline?.encodedPolyline || '',
            distanceMeters: distMeters,
            durationMinutes: durationMin,
            trafficStatus: traffic,
          };

          if (r.description) {
            routeResult.summary = `via ${r.description}`;
          }

          return routeResult;
        })
      );

      const primary = parsedRoutes[0]!;
      if (parsedRoutes.length > 1) {
        primary.alternatives = parsedRoutes.slice(1);
      }

      setWithEviction(drivingRouteCache, cacheKey, {
        data: primary,
        expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
      });
      return primary;
    }
  } catch {
    // Fall back to estimation model if Google API is unavailable
  }

  // Fallback estimation model
  const distKm = parseFloat(calculateDistanceKm(originLat, originLng, destLat, destLng).toFixed(1));
  const distMeters = Math.round(distKm * 1000);
  const durationMin = Math.max(2, Math.round((distKm / 35) * 60));
  const traffic = await classifyTraffic(distKm, durationMin, originLat, originLng, destLat, destLng);

  return {
    polyline: '',
    distanceMeters: distMeters,
    durationMinutes: durationMin,
    trafficStatus: traffic,
    summary: 'Fastest Route (Estimated)',
  };
}

/**
 * Calculates walking route from carpark to final destination venue.
 */
export async function getWalkingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<WalkingRoute> {
  const cacheKey = makeRouteKey(originLat, originLng, destLat, destLng);
  const cached = walkingRouteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const apiKey = getRoutingApiKey();
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: 'WALK',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await response.json()) as { routes?: GoogleRouteItem[]; error?: { message?: string } };

    if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
      const firstRoute: GoogleRouteItem = data.routes[0]!;
      const rawSeconds = parseInt((firstRoute.duration || '0s').replace('s', ''), 10);
      const durationMin = Math.max(1, Math.round(rawSeconds / 60));
      const distMeters = Math.round(firstRoute.distanceMeters || 0);

      const walkResult: WalkingRoute = {
        polyline: firstRoute.polyline?.encodedPolyline || '',
        distanceMeters: distMeters,
        durationMinutes: durationMin,
      };

      setWithEviction(walkingRouteCache, cacheKey, {
        data: walkResult,
        expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
      });
      return walkResult;
    }
  } catch {
    // Fall back to distance estimation
  }

  // Fallback calculation using shared WALKING_SPEED_M_PER_MIN
  const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);
  const distMeters = Math.round(distKm * 1000);
  const durationMin = Math.max(1, Math.round(distMeters / WALKING_SPEED_M_PER_MIN));

  return {
    polyline: '',
    distanceMeters: distMeters,
    durationMinutes: durationMin,
  };
}
