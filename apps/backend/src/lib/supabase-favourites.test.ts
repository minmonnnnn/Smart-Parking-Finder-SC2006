import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { createSupabaseFavouritesGateway } from './supabase-favourites.js'

const row = {
  favourite_id: 7, user_id: 'user-1', location_name: 'Home', address: '1 Main St',
  latitude: 1.3, longitude: 103.8, created_at: '2026-09-30T00:00:00.000Z',
}
const mapped = {
  id: 7, userId: 'user-1', locationName: 'Home', address: '1 Main St',
  latitude: 1.3, longitude: 103.8, createdAt: '2026-09-30T00:00:00.000Z',
}
const input = { locationName: 'Home', address: '1 Main St', latitude: 1.3, longitude: 103.8 }

function client(result: { data: unknown; error: unknown }) {
  const calls: unknown[] = []
  const query = {
    select: (columns: string) => { calls.push(['select', columns]); return query },
    eq: (column: string, value: unknown) => { calls.push(['eq', column, value]); return query },
    order: async (column: string) => { calls.push(['order', column]); return result },
    single: async () => result,
    maybeSingle: async () => result,
  }
  const database = {
    from: (table: string) => {
      calls.push(['from', table])
      return {
        select: query.select,
        insert: (value: unknown) => { calls.push(['insert', value]); return query },
        update: (value: unknown) => { calls.push(['update', value]); return query },
        delete: () => { calls.push(['delete']); return query },
      }
    },
  } as unknown as SupabaseClient
  return { database, calls }
}

describe('Supabase favourites gateway', () => {
  it('lists only authenticated user rows and maps database fields', async () => {
    const { database, calls } = client({ data: [row], error: null })
    await expect(createSupabaseFavouritesGateway(database).list('user-1')).resolves.toEqual([mapped])
    expect(calls).toContainEqual(['eq', 'user_id', 'user-1'])
  })

  it('inserts the user ID and maps the created row', async () => {
    const { database, calls } = client({ data: row, error: null })
    await expect(createSupabaseFavouritesGateway(database).create('user-1', input)).resolves.toEqual(mapped)
    expect(calls).toContainEqual(['insert', {
      user_id: 'user-1', location_name: 'Home', address: '1 Main St', latitude: 1.3, longitude: 103.8,
    }])
  })

  it('filters rename by both favourite ID and user ID', async () => {
    const { database, calls } = client({ data: { ...row, location_name: 'Work' }, error: null })
    await expect(createSupabaseFavouritesGateway(database).rename('user-1', 7, { locationName: 'Work' }))
      .resolves.toEqual({ ...mapped, locationName: 'Work' })
    expect(calls).toContainEqual(['update', { location_name: 'Work' }])
    expect(calls).toContainEqual(['eq', 'favourite_id', 7])
    expect(calls).toContainEqual(['eq', 'user_id', 'user-1'])
  })

  it('filters delete by both favourite ID and user ID', async () => {
    const { database, calls } = client({ data: { favourite_id: 7 }, error: null })
    await expect(createSupabaseFavouritesGateway(database).delete('user-1', 7)).resolves.toBe(true)
    expect(calls).toContainEqual(['eq', 'favourite_id', 7])
    expect(calls).toContainEqual(['eq', 'user_id', 'user-1'])
  })

  it('treats absent update and delete rows alike regardless of ownership', async () => {
    const { database } = client({ data: null, error: null })
    const gateway = createSupabaseFavouritesGateway(database)
    await expect(gateway.rename('user-1', 7, { locationName: 'Work' })).resolves.toBeNull()
    await expect(gateway.delete('user-1', 7)).resolves.toBe(false)
  })

  it('preserves database error codes for service error mapping', async () => {
    const failure = { code: '23505', message: 'private provider text' }
    const { database } = client({ data: null, error: failure })
    await expect(createSupabaseFavouritesGateway(database).create('user-1', input))
      .rejects.toBe(failure)
  })
})
