import {
  type DrivingRoute,
  type WalkingRoute,
  calculateDistanceKm,
  WALKING_SPEED_M_PER_MIN,
} from '@smart-parking/shared-types';
import type { IRoutingStrategy, RouteCoordinates } from './routing-strategy.interface.js';
import { classifyTraffic } from '../traffic-classifier.js';

/**
 * Fallback routing strategy that calculates routes geometrically using
 * the Haversine formula, empirical speed degradation, and LTA DataMall incidents.
 * Operates offline without requiring external API keys.
 */
export class GeometricFallbackStrategy implements IRoutingStrategy {
  readonly strategyName = 'GeometricFallback';

  async computeDrivingRoute(coords: RouteCoordinates): Promise<DrivingRoute> {
    const { originLat, originLng, destLat, destLng } = coords;

    const distKm = parseFloat(calculateDistanceKm(originLat, originLng, destLat, destLng).toFixed(1));
    const distMeters = Math.round(distKm * 1000);
    // Average Singapore arterial road speed: 35 km/h
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

  async computeWalkingRoute(coords: RouteCoordinates): Promise<WalkingRoute> {
    const { originLat, originLng, destLat, destLng } = coords;

    const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);
    const distMeters = Math.round(distKm * 1000);
    const durationMin = Math.max(1, Math.round(distMeters / WALKING_SPEED_M_PER_MIN));

    return {
      polyline: '',
      distanceMeters: distMeters,
      durationMinutes: durationMin,
    };
  }
}

