import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFavourite, deleteFavourite, listFavourites, renameFavourite } from './favouritesApi'

const favourite = { id: 7, userId: 'driver-1', locationName: 'Home', address: '1 Main St', latitude: 1.3, longitude: 103.8, createdAt: '2026-09-30T00:00:00.000Z' }

afterEach(() => vi.unstubAllGlobals())

describe('favourites API', () => {
  it('uses the bearer token for listing and creating favourites', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([favourite])).mockResolvedValueOnce(Response.json(favourite, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await listFavourites('token')).toEqual([favourite])
    const input = { locationName: 'Home', address: '1 Main St', latitude: 1.3, longitude: 103.8 }
    expect(await createFavourite('token', input)).toEqual(favourite)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/favourites')
    expect(fetchMock.mock.calls[0]?.[1]?.headers.get('Authorization')).toBe('Bearer token')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify(input) })
  })

  it('renames and deletes by ID', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ ...favourite, locationName: 'Office' })).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await renameFavourite('token', 7, 'Office')).toMatchObject({ locationName: 'Office' })
    await deleteFavourite('token', 7)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/favourites/7')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ locationName: 'Office' }) })
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' })
    expect(fetchMock.mock.calls[1]?.[1]?.headers.get('Authorization')).toBe('Bearer token')
  })
})
