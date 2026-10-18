import type { CreateFavouriteRequest, FavouriteLocation, RenameFavouriteRequest } from '@smart-parking/shared-types'
import { ApiException } from '../../lib/errors/index.js'

/**
 * Persistence abstraction for user favourite locations.
 *
 * Implementations must scope all operations to the authenticated user
 * so that users cannot access or modify another user's favourites.
 */
export interface FavouriteGateway {
  list(userId: string): Promise<FavouriteLocation[]>
  create(userId: string, input: CreateFavouriteRequest): Promise<FavouriteLocation>
  rename(userId: string, id: number, input: RenameFavouriteRequest): Promise<FavouriteLocation | null>
  delete(userId: string, id: number): Promise<boolean>
}

function unavailable(): ApiException {
  return new ApiException(503, 'EXTERNAL_SERVICE_UNAVAILABLE', 'Favourites service unavailable')
}

function notFound(): ApiException {
  return new ApiException(404, 'NOT_FOUND', 'Favourite not found')
}

/**
 * Creates the service responsible for managing favourite locations.
 *
 * The service handles user-scoped retrieval, duplicate detection,
 * renaming, deletion, and conversion of persistence failures into
 * application-level API errors.
 */
export function createFavouritesService(gateway: FavouriteGateway) {
  return {
    async list(userId: string): Promise<FavouriteLocation[]> {
      try {
        return await gateway.list(userId)
      } catch (error) {
        console.error('FavouritesService.list error:', error)
        throw unavailable()
      }
    },

    async create(userId: string, input: CreateFavouriteRequest): Promise<FavouriteLocation> {
      try {
        return await gateway.create(userId, input)
      } catch (error) {
        if (error !== null && typeof error === 'object' && 'code' in error && error.code === '23505') {
          throw new ApiException(409, 'FAVOURITE_ALREADY_EXISTS', 'Favourite already exists')
        }
        console.error('FavouritesService.create error:', error)
        throw unavailable()
      }
    },

    async rename(userId: string, id: number, input: RenameFavouriteRequest): Promise<FavouriteLocation> {
      let favourite: FavouriteLocation | null
      try {
        favourite = await gateway.rename(userId, id, input)
      } catch (error) {
        console.error('FavouritesService.rename error:', error)
        throw unavailable()
      }
      if (!favourite) throw notFound()
      return favourite
    },

    async delete(userId: string, id: number): Promise<void> {
      let deleted: boolean
      try {
        deleted = await gateway.delete(userId, id)
      } catch (error) {
        console.error('FavouritesService.delete error:', error)
        throw unavailable()
      }
      if (!deleted) throw notFound()
    },
  }
}
