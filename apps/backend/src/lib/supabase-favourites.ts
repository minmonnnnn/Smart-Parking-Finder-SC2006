import type { SupabaseClient } from '@supabase/supabase-js'
import type { FavouriteLocation } from '@smart-parking/shared-types'
import type { FavouriteGateway } from '../modules/favourites/favourites.service.js'

type FavouriteRow = {
  favourite_id: number
  user_id: string
  location_name: string
  address: string
  latitude: number
  longitude: number
  created_at: string
}

const columns = 'favourite_id, user_id, location_name, address, latitude, longitude, created_at'

function mapFavourite(row: FavouriteRow): FavouriteLocation {
  return {
    id: row.favourite_id,
    userId: row.user_id,
    locationName: row.location_name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
  }
}

export function createSupabaseFavouritesGateway(client: SupabaseClient): FavouriteGateway {
  return {
    async list(userId) {
      const { data, error } = await client.from('favourite_locations')
        .select(columns).eq('user_id', userId).order('favourite_id')
      if (error) throw error
      if (!data) throw new Error('Missing favourites result')
      return (data as FavouriteRow[]).map(mapFavourite)
    },

    async create(userId, input) {
      const { data, error } = await client.from('favourite_locations').insert({
        user_id: userId,
        location_name: input.locationName,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
      }).select(columns).single()
      if (error) throw error
      if (!data) throw new Error('Missing created favourite')
      return mapFavourite(data as FavouriteRow)
    },

    async rename(userId, id, input) {
      const { data, error } = await client.from('favourite_locations')
        .update({ location_name: input.locationName })
        .eq('favourite_id', id).eq('user_id', userId)
        .select(columns).maybeSingle()
      if (error) throw error
      return data ? mapFavourite(data as FavouriteRow) : null
    },

    async delete(userId, id) {
      const { data, error } = await client.from('favourite_locations')
        .delete().eq('favourite_id', id).eq('user_id', userId)
        .select('favourite_id').maybeSingle()
      if (error) throw error
      return data !== null
    },
  }
}
