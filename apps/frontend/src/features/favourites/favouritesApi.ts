import type { CreateFavouriteRequest, FavouriteLocation } from '@smart-parking/shared-types'
import { apiRequest } from '../../lib/apiClient'

export function listFavourites(token: string): Promise<FavouriteLocation[]> {
  return apiRequest('/api/favourites', { token })
}

export function createFavourite(token: string, input: CreateFavouriteRequest): Promise<FavouriteLocation> {
  return apiRequest('/api/favourites', { method: 'POST', token, body: JSON.stringify(input) })
}

export function renameFavourite(token: string, id: number, locationName: string): Promise<FavouriteLocation> {
  return apiRequest(`/api/favourites/${id}`, { method: 'PATCH', token, body: JSON.stringify({ locationName }) })
}

export function deleteFavourite(token: string, id: number): Promise<void> {
  return apiRequest(`/api/favourites/${id}`, { method: 'DELETE', token })
}
