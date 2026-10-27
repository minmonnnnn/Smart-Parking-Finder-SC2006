import type { CreateFavouriteRequest, FavouriteLocation } from '@smart-parking/shared-types'
import { apiRequest } from '../../lib/apiClient'

// Retrieves all favourite locations belonging to the authenticated user
export function listFavourites(token: string): Promise<FavouriteLocation[]> {
  return apiRequest('/api/favourites', { token })
}

// Saves a destination as a new favourite location
export function createFavourite(token: string, input: CreateFavouriteRequest): Promise<FavouriteLocation> {
  return apiRequest('/api/favourites', { method: 'POST', token, body: JSON.stringify(input) })
}

// Renames an existing favourite location
export function renameFavourite(token: string, id: number, locationName: string): Promise<FavouriteLocation> {
  return apiRequest(`/api/favourites/${id}`, { method: 'PATCH', token, body: JSON.stringify({ locationName }) })
}

// Permanently removes a favourite location
export function deleteFavourite(token: string, id: number): Promise<void> {
  return apiRequest(`/api/favourites/${id}`, { method: 'DELETE', token })
}
