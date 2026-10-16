import { apiRequest } from '../../lib/apiClient'
import type { DestinationSuggestion, Destination } from '@smart-parking/shared-types'
import type { NearbyCarparksResponse, CarparkFilters } from '@smart-parking/shared-types'

export async function searchDestinations(query: string): Promise<DestinationSuggestion[]> {
  return apiRequest<DestinationSuggestion[]>(
    `/api/destinations/search?query=${encodeURIComponent(query)}`,
  )
}

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
