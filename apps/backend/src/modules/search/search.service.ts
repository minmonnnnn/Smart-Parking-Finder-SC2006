/**
 * GET /api/carparks/nearby orchestrator — owner: Min
 * FR8–FR10, FR43–FR49, UC-01
 *
 * Calls Moufooza's carpark DB, Xi Fei's availability cache, Xavier's routing
 * functions, and Nigel's recommendation engine. Partial failures are caught
 * individually; degraded services are listed in the response so the frontend
 * can show a banner rather than an error screen.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Carpark,
  CarparkFilters,
  CarparkSort,
  NearbyCarparksResponse,
  RankedCarpark,
  AvailabilityInfo,
  CarparkDataService,
  CarparkDetails,
} from '@smart-parking/shared-types';
import { getCarparksNearby, getCarparkByNo } from './carpark.repository.js';
import { getAvailabilityByCarParkNo } from '../availability/repository.js';
import { getDrivingRoute, getWalkingRoute, calculateDistanceKm } from '../routing/routing.service.js';
import { calculateRecommendationScore } from '../recommendation/recommendation-score.js';
import { getHistoricalAvailabilityRatio } from '../recommendation/historical-availability.js';
import { getWeather } from '../weather/weather.service.js';

const AVAILABILITY_STATUS_RANK = { High: 3, Moderate: 2, Low: 1, Unavailable: 0 } as const;

function fallbackAvailability(): AvailabilityInfo {
  return {
    availableLots: 0,
    totalLots: 0,
    status: 'Unavailable',
    lastUpdated: new Date().toISOString(),
    isStale: true,
  };
}

function passesFilters(
  carpark: Carpark,
  availability: AvailabilityInfo,
  filters: CarparkFilters,
): boolean {
  if (filters.evChargingOnly && !carpark.hasEvCharging) return false;
  if (filters.shelteredOnly && !carpark.isSheltered) return false;
  if (filters.maxCost !== undefined && carpark.parkingCost !== null && carpark.parkingCost > filters.maxCost) return false;
  if (filters.minAvailability) {
    const required = AVAILABILITY_STATUS_RANK[filters.minAvailability];
    const actual = AVAILABILITY_STATUS_RANK[availability.status];
    if (actual < required) return false;
  }
  return true;
}

export interface NearbyCarparksInput {
  destinationLat: number;
  destinationLng: number;
  originLat?: number;
  originLng?: number;
  sort?: CarparkSort;
  filters?: CarparkFilters;
}

export async function getNearbyCarparks(
  client: SupabaseClient,
  input: NearbyCarparksInput,
): Promise<NearbyCarparksResponse> {
  const {
    destinationLat,
    destinationLng,
    originLat,
    originLng,
    sort = 'distance',
    filters = {},
  } = input;

  const degradedServices: CarparkDataService[] = [];

  // 1. Fetch weather for the destination (Moufooza — FR24–FR26)
  let rainExpected = false;
  try {
    const weather = await getWeather(destinationLat, destinationLng);
    rainExpected = weather.rainExpected;
  } catch {
    degradedServices.push('weather');
  }

  // 3. Fetch candidate carparks from DB
  let carparks: Carpark[];
  try {
    carparks = await getCarparksNearby(client, destinationLat, destinationLng);
  } catch {
    // Static carpark data unavailable — cannot produce results
    throw new Error('EXTERNAL_SERVICE_UNAVAILABLE');
  }

  if (carparks.length === 0) {
    return { carparks: [], degradedServices };
  }

  // 2. Pre-filter candidate carparks by user filters and compute proximity
  const filteredCandidates = carparks
    .map((carpark) => {
      let availability: AvailabilityInfo;
      try {
        const cached = getAvailabilityByCarParkNo(carpark.carParkNo);
        availability = cached ?? fallbackAvailability();
        if (!cached && !degradedServices.includes('availability')) {
          degradedServices.push('availability');
        }
      } catch {
        if (!degradedServices.includes('availability')) degradedServices.push('availability');
        availability = fallbackAvailability();
      }

      // Apply filters before paying for routing calls
      if (!passesFilters(carpark, availability, filters)) return null;

      // Walking distance (straight-line Haversine pre-filter)
      const walkingDistanceKm = calculateDistanceKm(
        carpark.latitude, carpark.longitude,
        destinationLat, destinationLng,
      );
      const walkingDistanceMeters = Math.round(walkingDistanceKm * 1000);

      return {
        carpark,
        availability,
        walkingDistanceMeters,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (filteredCandidates.length === 0) {
    return { carparks: [], degradedServices };
  }

  // Sort candidates by proximity to destination
  filteredCandidates.sort((a, b) => a.walkingDistanceMeters - b.walkingDistanceMeters);

  // Limit live routing calls to top 10 closest matching carparks (Option B)
  const MAX_CANDIDATES = 10;
  const topCandidates = filteredCandidates.slice(0, MAX_CANDIDATES);

  // 3. Enrich top candidates in parallel with live routes and recommendation scores
  const now = new Date();
  const arrivalDayOfWeek = now.getDay();
  const arrivalHour = now.getHours();

  const enriched = await Promise.all(
    topCandidates.map(async ({ carpark, availability, walkingDistanceMeters }): Promise<RankedCarpark> => {
      // Walking ETA (Xavier)
      let walkingEtaMinutes = Math.max(1, Math.round(walkingDistanceMeters / 75));
      try {
        const walkRoute = await getWalkingRoute(
          carpark.latitude, carpark.longitude,
          destinationLat, destinationLng,
        );
        walkingEtaMinutes = walkRoute.durationMinutes;
      } catch {
        if (!degradedServices.includes('routing')) degradedServices.push('routing');
      }

      // Driving ETA (Xavier) — only when origin is provided
      let drivingEtaMinutes: number | null = null;
      if (originLat !== undefined && originLng !== undefined) {
        try {
          const driveRoute = await getDrivingRoute(originLat, originLng, carpark.latitude, carpark.longitude);
          drivingEtaMinutes = driveRoute.durationMinutes;
        } catch {
          if (!degradedServices.includes('routing')) degradedServices.push('routing');
        }
      }

      // Historical availability (Nigel)
      let historicalRatio: number | null = null;
      try {
        historicalRatio = await getHistoricalAvailabilityRatio(
          carpark.carParkNo,
          arrivalDayOfWeek,
          arrivalHour,
        );
      } catch {
        if (!degradedServices.includes('historical')) degradedServices.push('historical');
      }

      // Recommendation score (Nigel)
      let recommendationScore = 0;
      const realTimeRatio =
        availability.totalLots > 0
          ? availability.availableLots / availability.totalLots
          : null;
      try {
        if (realTimeRatio !== null) {
          const result = calculateRecommendationScore({
            realTimeAvailabilityRatio: realTimeRatio,
            historicalAvailabilityRatio: historicalRatio,
            etaMinutes: drivingEtaMinutes ?? walkingEtaMinutes,
            walkingDistanceMeters,
            rainExpected,
            isSheltered: carpark.isSheltered,
          });
          recommendationScore = result.finalScore;
        }
      } catch {
        // Non-fatal — score stays 0
      }

      return {
        carpark,
        distanceMeters: walkingDistanceMeters,
        drivingEtaMinutes,
        walkingEtaMinutes,
        availability,
        recommendationScore,
      };
    }),
  );

  if (sort === 'recommended') {
    enriched.sort((a, b) => b.recommendationScore - a.recommendationScore);
  } else {
    enriched.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  return { carparks: enriched, degradedServices };
}

export async function getCarparkDetails(
  client: SupabaseClient,
  carParkNo: string,
): Promise<CarparkDetails | null> {
  const carpark = await getCarparkByNo(client, carParkNo);
  if (!carpark) return null;

  const cached = getAvailabilityByCarParkNo(carpark.carParkNo);
  const availability = cached ?? {
    availableLots: 0,
    totalLots: 0,
    status: 'Unavailable' as const,
    lastUpdated: new Date().toISOString(),
    isStale: true,
  };

  return { carpark, availability };
}
