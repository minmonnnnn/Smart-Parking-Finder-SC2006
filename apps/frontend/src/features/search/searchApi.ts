import { apiRequest } from '../../lib/apiClient'
import type { DestinationSuggestion, Destination } from '@smart-parking/shared-types'
import type { NearbyCarparksResponse, CarparkFilters } from '@smart-parking/shared-types'

/**
 * Fetches destination autocomplete suggestions from Google Places via the backend proxy.
 * @param query - The user's partial search text
 * @returns List of place suggestions with name, address, and placeId
 */
export async function searchDestinations(query: string): Promise<DestinationSuggestion[]> {
  return apiRequest<DestinationSuggestion[]>(
    `/api/destinations/search?query=${encodeURIComponent(query)}`,
  )
}

/**
 * Resolves a Google Places placeId to full coordinates and display name.
 * @param placeId - The Google Places ID from a suggestion
 * @returns Resolved destination with latitude, longitude, and name
 */
export async function resolveDestination(placeId: string): Promise<Destination> {
  return apiRequest<Destination>(`/api/destinations/${encodeURIComponent(placeId)}/resolve`)
}

export interface NearbyParams {
  destinationLat: number
  destinationLng: number
  originLat?: number
  originLng?: number
  filters?: CarparkFilters
}

/**
 * Fetches ranked carparks near a destination, enriched with live availability,
 * route times, and recommendation scores.
 * @param params - Destination coordinates, optional user origin, and active filters
 * @returns Ranked carpark list and names of any degraded backend services
 */
export async function getNearbyCarparks(params: NearbyParams): Promise<NearbyCarparksResponse> {
  const q = new URLSearchParams({
    destinationLat: String(params.destinationLat),
    destinationLng: String(params.destinationLng),
  })
  if (params.originLat !== undefined) q.set('originLat', String(params.originLat))
  if (params.originLng !== undefined) q.set('originLng', String(params.originLng))
  if (params.filters?.evChargingOnly) q.set('evChargingOnly', 'true')
  if (params.filters?.shelteredOnly) q.set('shelteredOnly', 'true')
  return apiRequest<NearbyCarparksResponse>(`/api/carparks/nearby?${q.toString()}`)
}
