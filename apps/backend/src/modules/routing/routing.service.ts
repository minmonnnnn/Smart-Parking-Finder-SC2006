/**
 * Routing and Navigation Service (Owner: Xavier)
 * Fulfills FR21-FR23, FR28-FR34, UC-03, UC-04, UC-09
 *
 * Implements Google Routes API (New) integration with fallback estimation.
 * Exported as reusable async functions so Min's orchestrator and Nigel's
 * scoring engine can call them directly without HTTP overhead (per API_CONTRACT.md).
 */

import type { DrivingRoute, WalkingRoute, TrafficStatus } from './types.js';

// Haversine formula to compute great-circle distance in kilometers
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
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

// Classifies traffic based on speed vs typical free-flow conditions (FR23)
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

/**
 * Calculates driving route from origin to destination/carpark.
 * Fulfills FR21-FR23, FR28, FR30, FR31, FR34.
 */
export async function getDrivingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DrivingRoute> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCAUS68gz8Fg2Nsb6O1VeDUZcqwjnNChLQ';

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

      return primary;
    }
  } catch (error) {
    console.warn('[RoutingService] Google Routes API failed, falling back to estimation model:', error);
  }

  // Resilient fallback estimation if external API is throttled or offline (UC-09.EX.3)
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

/**
 * Calculates pedestrian walking route from carpark to final destination venue.
 * Fulfills FR29, FR32.
 */
export async function getWalkingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<WalkingRoute> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCAUS68gz8Fg2Nsb6O1VeDUZcqwjnNChLQ';

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

    if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
      const firstRoute = data.routes[0]!;
      const rawSeconds = parseInt((firstRoute.duration || '0s').replace('s', ''), 10);
      const durationMin = Math.max(1, Math.round(rawSeconds / 60));
      const distMeters = Math.round(firstRoute.distanceMeters || 0);

      return {
        polyline: firstRoute.polyline?.encodedPolyline || '',
        distanceMeters: distMeters,
        durationMinutes: durationMin,
      };
    }
  } catch (error) {
    console.warn('[RoutingService] Google Routes walking API failed, using distance estimation:', error);
  }

  // Walking speed approx 4.5 km/h (75 meters / minute)
  const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);
  const distMeters = Math.round(distKm * 1000);
  const durationMin = Math.max(1, Math.round(distMeters / 75));

  return {
    polyline: '',
    distanceMeters: distMeters,
    durationMinutes: durationMin,
  };
}

