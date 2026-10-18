import type { DrivingRoute, WalkingRoute, TrafficStatus } from '@smart-parking/shared-types';

//haversine formula to calculate distance
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // earth's radius (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

//function to calculate traffic conditions
function classifyTraffic(distanceKm: number, durationMinutes: number): TrafficStatus {
  if (distanceKm <= 0 || durationMinutes <= 0) return 'Light';
  const effectiveSpeedKmh = (distanceKm / durationMinutes) * 60;

  if (effectiveSpeedKmh < 22) {
    return 'Heavy';
  } else if (effectiveSpeedKmh < 38) {
    return 'Moderate';
  }
  return 'Light';
}

//cache to prevent duplicate api calls
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const drivingRouteCache = new Map<string, CacheEntry<DrivingRoute>>();
const walkingRouteCache = new Map<string, CacheEntry<WalkingRoute>>();
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

//generates a cache to store identical routes
function makeRouteKey(oLat: number, oLng: number, dLat: number, dLng: number): string {
  return `${oLat.toFixed(4)},${oLng.toFixed(4)}->${dLat.toFixed(4)},${dLng.toFixed(4)}`;
}

//retrieve the google api from env
function getRoutingApiKey(): string {
  const rawKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!rawKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not set');
  }
  return rawKey.split('#')[0]!.trim();
}

//calculates driving route from starting position to carpark
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

  const apiKey = getRoutingApiKey();

  try {
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
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn(`[RoutingService] Google Routes API returned HTTP ${response.status}:`, data?.error?.message || data);
    }

    if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
      interface GoogleRouteItem {
        duration?: string;
        distanceMeters?: number;
        description?: string;
        polyline?: { encodedPolyline?: string };
      }

      const parsedRoutes = data.routes.map((r: GoogleRouteItem) => {
        const rawSeconds = parseInt((r.duration || '0s').replace('s', ''), 10);
        const durationMin = Math.max(1, Math.round(rawSeconds / 60));
        const distMeters = Math.round(r.distanceMeters || 0);
        const distKm = distMeters / 1000;
        const traffic = classifyTraffic(distKm, durationMin);

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
      });

      const primary = parsedRoutes[0]!;
      if (parsedRoutes.length > 1) {
        primary.alternatives = parsedRoutes.slice(1);
      }

      drivingRouteCache.set(cacheKey, { data: primary, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
      return primary;
    }
  } catch (error) {
    console.warn('[RoutingService] Google Routes API failed, falling back to estimation model:', error);
  }

  //fallback if google maps API doesnt work
  const distKm = parseFloat(calculateDistanceKm(originLat, originLng, destLat, destLng).toFixed(1));
  const distMeters = Math.round(distKm * 1000);
  const durationMin = Math.max(2, Math.round((distKm / 35) * 60));
  const traffic = classifyTraffic(distKm, durationMin);

  return {
    polyline: '',
    distanceMeters: distMeters,
    durationMinutes: durationMin,
    trafficStatus: traffic,
    summary: 'Fastest Route (Estimated)',
    alternatives: [
      {
        polyline: '',
        distanceMeters: Math.round(distMeters * 1.15),
        durationMinutes: durationMin + 3,
        trafficStatus: 'Light',
        summary: 'Alternative Route (Estimated)',
      },
    ],
  };
}

//Calculates walking route from carpark to final destination venue
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

  const apiKey = getRoutingApiKey();

  try {
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
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn(`[RoutingService] Google Routes walking API returned HTTP ${response.status}:`, data?.error?.message || data);
    }

    if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
      const firstRoute = data.routes[0]!;
      const rawSeconds = parseInt((firstRoute.duration || '0s').replace('s', ''), 10);
      const durationMin = Math.max(1, Math.round(rawSeconds / 60));
      const distMeters = Math.round(firstRoute.distanceMeters || 0);

      const walkResult: WalkingRoute = {
        polyline: firstRoute.polyline?.encodedPolyline || '',
        distanceMeters: distMeters,
        durationMinutes: durationMin,
      };
      walkingRouteCache.set(cacheKey, { data: walkResult, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
      return walkResult;
    }
  } catch (error) {
    console.warn('[RoutingService] Google Routes walking API failed, using distance estimation:', error);
  }

  //fallback calculation for walking distance and duration
  const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);
  const distMeters = Math.round(distKm * 1000);
  const durationMin = Math.max(1, Math.round(distMeters / 75));

  return {
    polyline: '',
    distanceMeters: distMeters,
    durationMinutes: durationMin,
  };
}

