import { calculateDistanceKm } from '@smart-parking/shared-types';

export interface LtaTrafficIncident {
  Type: string;
  Latitude: number;
  Longitude: number;
  Message: string;
}

const LTA_INCIDENTS_URL = 'https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents';
const LTA_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

interface LtaCache {
  data: LtaTrafficIncident[];
  expiresAt: number;
}

let ltaCache: LtaCache | null = null;

/**
 * Retrieves real-time traffic incidents from LTA DataMall (FR21).
 * Caches responses for 3 minutes to avoid hammering the endpoint.
 * Returns an empty array if LTA_DATAMALL_API_KEY is not configured or if the request fails.
 */
export async function getLtaTrafficIncidents(): Promise<LtaTrafficIncident[]> {
  if (ltaCache && ltaCache.expiresAt > Date.now()) {
    return ltaCache.data;
  }

  const accountKey = process.env.LTA_DATAMALL_API_KEY?.split('#')[0]?.trim();
  if (!accountKey) {
    return [];
  }

  try {
    const response = await fetch(LTA_INCIDENTS_URL, {
      headers: {
        AccountKey: accountKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as { value?: LtaTrafficIncident[] };
    const incidents = Array.isArray(json.value) ? json.value : [];
    ltaCache = { data: incidents, expiresAt: Date.now() + LTA_CACHE_TTL_MS };
    console.log(`[LTA Traffic] Successfully retrieved ${incidents.length} active traffic incidents from LTA DataMall`);
    return incidents;
  } catch {
    return [];
  }
}

/**
 * Checks if any reported traffic incidents are within radiusKm of the route segment / midpoint.
 * Defaults to 0.8 km corridor radius to avoid distant false-positive escalations on local routes.
 */
export function hasNearbyIncidents(
  incidents: LtaTrafficIncident[],
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  radiusKm = 0.8
): boolean {
  if (!incidents || incidents.length === 0) return false;

  const midLat = (originLat + destLat) / 2;
  const midLng = (originLng + destLng) / 2;

  return incidents.some((inc) => {
    if (typeof inc.Latitude !== 'number' || typeof inc.Longitude !== 'number') return false;
    // Check distance to midpoint or endpoints
    const distToMid = calculateDistanceKm(midLat, midLng, inc.Latitude, inc.Longitude);
    const distToOrigin = calculateDistanceKm(originLat, originLng, inc.Latitude, inc.Longitude);
    const distToDest = calculateDistanceKm(destLat, destLng, inc.Latitude, inc.Longitude);

    return distToMid <= radiusKm || distToOrigin <= radiusKm || distToDest <= radiusKm;
  });
}

