import type { DrivingRoute, WalkingRoute } from '@smart-parking/shared-types';
import type { IRoutingStrategy, RouteCoordinates } from './routing-strategy.interface.js';
import { classifyTraffic } from '../traffic-classifier.js';

interface GoogleRouteItem {
  duration?: string;
  staticDuration?: string;
  distanceMeters?: number;
  description?: string;
  polyline?: { encodedPolyline?: string };
}

function getRoutingApiKey(): string {
  const rawKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!rawKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not set');
  }
  return rawKey.split('#')[0]!.trim();
}

/**
 * Concrete routing strategy using Google Routes API v2 (TRAFFIC_AWARE)
 * and real-time LTA DataMall incident correlation.
 */
export class GoogleRoutesStrategy implements IRoutingStrategy {
  readonly strategyName = 'GoogleRoutes';

  async computeDrivingRoute(coords: RouteCoordinates): Promise<DrivingRoute> {
    const { originLat, originLng, destLat, destLng } = coords;
    const apiKey = getRoutingApiKey();

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'routes.duration,routes.staticDuration,routes.distanceMeters,routes.description,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await response.json()) as { routes?: GoogleRouteItem[]; error?: { message?: string } };

    if (!response.ok || data.error) {
      const msg = data.error?.message || response.statusText;
      console.warn(`[GoogleRoutesStrategy] computeRoutes failed (${response.status}):`, msg);
      throw new Error(`Google Routes API error: ${msg}`);
    }

    if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      throw new Error('Google Routes API returned no routes');
    }

    const parsedRoutes: DrivingRoute[] = await Promise.all(
      data.routes.map(async (r: GoogleRouteItem) => {
        const rawSeconds = parseInt((r.duration || '0s').replace('s', ''), 10);
        const durationMin = Math.max(1, Math.round(rawSeconds / 60));
        const distMeters = Math.round(r.distanceMeters || 0);
        const distKm = distMeters / 1000;

        const staticSeconds = r.staticDuration
          ? parseInt(r.staticDuration.replace('s', ''), 10)
          : undefined;
        const delayRatio =
          staticSeconds && staticSeconds > 0 ? rawSeconds / staticSeconds : undefined;

        const traffic = await classifyTraffic(
          distKm,
          durationMin,
          originLat,
          originLng,
          destLat,
          destLng,
          delayRatio
        );

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

    return primary;
  }

  async computeWalkingRoute(coords: RouteCoordinates): Promise<WalkingRoute> {
    const { originLat, originLng, destLat, destLng } = coords;
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

    if (!response.ok || data.error) {
      const msg = data.error?.message || response.statusText;
      console.warn(`[GoogleRoutesStrategy] Walking computeRoutes failed (${response.status}):`, msg);
      throw new Error(`Google Routes API error: ${msg}`);
    }

    if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      throw new Error('Google Routes API returned no walking routes');
    }

    const firstRoute: GoogleRouteItem = data.routes[0]!;
    const rawSeconds = parseInt((firstRoute.duration || '0s').replace('s', ''), 10);
    const durationMin = Math.max(1, Math.round(rawSeconds / 60));
    const distMeters = Math.round(firstRoute.distanceMeters || 0);

    return {
      polyline: firstRoute.polyline?.encodedPolyline || '',
      distanceMeters: distMeters,
      durationMinutes: durationMin,
    };
  }
}

