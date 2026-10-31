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
import { rankCarparks, type RecommendationCandidate } from '../recommendation/rank-carparks.js';
import { getHistoricalAvailabilityRatio } from '../recommendation/historical-availability.js';
import { getWeather } from '../weather/weather.service.js';

const AVAILABILITY_STATUS_RANK = { High: 3, Moderate: 2, Low: 1, Unavailable: 0 } as const;

/** Returns a zero-lot availability record used when the cache has no data for a carpark. */
function fallbackAvailability(): AvailabilityInfo {
  return {
    availableLots: 0,
    totalLots: 0,
    status: 'Unavailable',
    lastUpdated: new Date().toISOString(),
    isStale: true,
  };
}

/** Returns true if the carpark satisfies all active user filters. */
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

/**
 * Orchestrates the nearby carpark search pipeline:
 * weather → DB candidates → availability → routing → historical → scoring → sort.
 * Each upstream service failure is caught individually; the caller receives a
 * `degradedServices` list so the frontend can show a banner rather than an error.
 *
 * @param client - Supabase admin client for DB access
 * @param input - Destination coordinates, optional user origin, sort order, and filters
 * @returns Ranked carpark list and names of any services that failed
 */
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

  let rainExpected = false;
  try {
    const weather = await getWeather(destinationLat, destinationLng);
    rainExpected = weather.rainExpected;
  } catch {
    degradedServices.push('weather');
  }

  let carparks: Carpark[];
  try {
    carparks = await getCarparksNearby(client, destinationLat, destinationLng);
  } catch {
    throw new Error('EXTERNAL_SERVICE_UNAVAILABLE');
  }

  if (carparks.length === 0) {
    return { carparks: [], degradedServices };
  }

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

      if (!passesFilters(carpark, availability, filters)) return null;
      if (sort === 'recommended' && availability.availableLots <= 0) return null;

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

  filteredCandidates.sort((a, b) => a.walkingDistanceMeters - b.walkingDistanceMeters);

  const MAX_CANDIDATES = 10;
  const topCandidates = filteredCandidates.slice(0, MAX_CANDIDATES);

  const now = new Date();
  const arrivalDayOfWeek = now.getDay();
  const arrivalHour = now.getHours();

  const candidates: RecommendationCandidate[] = await Promise.all(
    topCandidates.map(async ({ carpark, availability, walkingDistanceMeters }): Promise<RecommendationCandidate> => {
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

      let drivingEtaMinutes: number | null = null;
      if (originLat !== undefined && originLng !== undefined) {
        try {
          const driveRoute = await getDrivingRoute(originLat, originLng, carpark.latitude, carpark.longitude);
          drivingEtaMinutes = driveRoute.durationMinutes;
        } catch {
          if (!degradedServices.includes('routing')) degradedServices.push('routing');
        }
      }

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

      return {
        carpark,
        distanceMeters: walkingDistanceMeters,
        drivingEtaMinutes: drivingEtaMinutes ?? walkingEtaMinutes,
        walkingEtaMinutes,
        availability,
        historicalAvailabilityRatio: historicalRatio,
        rainExpected,
      };
    }),
  );

  let ranked: RankedCarpark[];
  if (sort === 'recommended') {
    try {
      ranked = rankCarparks(candidates);
    } catch {
      ranked = candidates.map((c) => ({
        carpark: c.carpark,
        distanceMeters: c.distanceMeters,
        drivingEtaMinutes: c.drivingEtaMinutes,
        walkingEtaMinutes: c.walkingEtaMinutes,
        availability: c.availability,
        recommendationScore: 0,
      }));
    }
  } else {
    ranked = candidates
      .map((c) => ({
        carpark: c.carpark,
        distanceMeters: c.distanceMeters,
        drivingEtaMinutes: c.drivingEtaMinutes,
        walkingEtaMinutes: c.walkingEtaMinutes,
        availability: c.availability,
        recommendationScore: 0,
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  return { carparks: ranked, degradedServices };
}

/**
 * Returns static carpark data combined with live availability for a single carpark.
 * @param client - Supabase admin client
 * @param carParkNo - The HDB carpark code (e.g. "HG9")
 * @returns Carpark details, or null if the carpark is not in the database
 */
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
