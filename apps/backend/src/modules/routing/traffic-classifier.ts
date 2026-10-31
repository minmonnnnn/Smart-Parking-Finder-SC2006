import { type TrafficStatus } from '@smart-parking/shared-types';
import { getLtaTrafficIncidents, hasNearbyIncidents } from './lta-traffic.service.js';

/**
 * Classifies traffic conditions using delay ratio (live vs static duration),
 * distance-aware speed thresholds for local estate vs arterial routes,
 * and LTA DataMall incident reports (FR21, FR23).
 */
export async function classifyTraffic(
  distanceKm: number,
  durationMinutes: number,
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  delayRatio?: number
): Promise<TrafficStatus> {
  if (distanceKm <= 0 || durationMinutes <= 0) return 'Light';

  let traffic: TrafficStatus;

  if (delayRatio !== undefined && !Number.isNaN(delayRatio)) {
    // Traffic delay ratio computed from Google Routes (duration / staticDuration)
    if (delayRatio < 1.15) {
      traffic = 'Light';
    } else if (delayRatio < 1.35) {
      traffic = 'Moderate';
    } else {
      traffic = 'Heavy';
    }
  } else {
    // Speed-based classification with context-sensitive thresholds
    const effectiveSpeedKmh = (distanceKm / durationMinutes) * 60;

    if (distanceKm < 3) {
      // Local / residential estate routes (< 3 km, e.g. carpark access roads)
      if (effectiveSpeedKmh < 10) {
        traffic = 'Heavy';
      } else if (effectiveSpeedKmh < 18) {
        traffic = 'Moderate';
      } else {
        traffic = 'Light';
      }
    } else {
      // Longer / arterial & expressway corridors (>= 3 km)
      if (effectiveSpeedKmh < 22) {
        traffic = 'Heavy';
      } else if (effectiveSpeedKmh < 38) {
        traffic = 'Moderate';
      } else {
        traffic = 'Light';
      }
    }
  }

  // Cross-reference with real-time LTA DataMall traffic incidents (FR21)
  try {
    const incidents = await getLtaTrafficIncidents();
    if (hasNearbyIncidents(incidents, originLat, originLng, destLat, destLng, 0.8)) {
      console.log('[LTA Traffic] Active incident detected along route corridor. Escalated traffic condition.');
      if (traffic === 'Light') traffic = 'Moderate';
      else if (traffic === 'Moderate') traffic = 'Heavy';
    }
  } catch {
    // If LTA service is unreachable, keep status
  }

  return traffic;
}

