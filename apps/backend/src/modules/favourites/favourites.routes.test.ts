import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { FavouriteLocation } from '@smart-parking/shared-types'
import { createApp } from '../../app.js'
import type { AuthGateway } from '../auth/auth.types.js'
import { createFavouritesRouter } from './favourites.routes.js'
import type { FavouriteGateway } from './favourites.service.js'

const home: FavouriteLocation = {
  id: 1, userId: 'user-1', locationName: 'Home', address: '1 Main St',
  latitude: 1.3, longitude: 103.8, createdAt: '2026-09-30T00:00:00.000Z',
}
const other: FavouriteLocation = { ...home, id: 2, userId: 'user-2', locationName: 'Other' }
const input = { locationName: ' Work ', address: ' Office ', latitude: 1.4, longitude: 103.9 }
const error = (code: string, message: string) => ({ error: { code, message } })

function authGateway(): AuthGateway {
  return {
    register: async () => ({ userId: 'user-1' }),
    createProfile: async () => {},
    removeAuthUser: async () => {},
    login: async () => ({ userId: 'user-1', token: 'token' }),
    verifyToken: async (token) => token === 'token' ? { userId: 'user-1' } : null,
    getProfile: async () => null,
    updateProfile: async () => null,
  }
}

function fixture(overrides: Partial<FavouriteGateway> = {}) {
  const rows = new Map([home, other].map((row) => [row.id, { ...row }]))
  const calls: unknown[] = []
  const gateway: FavouriteGateway = {
    list: async (userId) => {
      calls.push(['list', userId])
      return [...rows.values()].filter((row) => row.userId === userId)
    },
    create: async (userId, favourite) => {
      calls.push(['create', userId, favourite])
      const row = { ...home, ...favourite, id: 3, userId }
      rows.set(row.id, row)
      return row
    },
    rename: async (userId, id, patch) => {
      calls.push(['rename', userId, id, patch])
      const row = rows.get(id)
      if (!row || row.userId !== userId) return null
      const renamed = { ...row, ...patch }
      rows.set(id, renamed)
      return renamed
    },
    delete: async (userId, id) => {
      calls.push(['delete', userId, id])
      const row = rows.get(id)
      if (!row || row.userId !== userId) return false
      rows.delete(id)
      return true
    },
    ...overrides,
  }
  return { app: createApp({ favourites: createFavouritesRouter({ authGateway: authGateway(), gateway }) }), rows, calls }
}

function authorized(app: ReturnType<typeof fixture>['app']) {
  return {
    get: () => request(app).get('/api/favourites').set('Authorization', 'Bearer token'),
    post: () => request(app).post('/api/favourites').set('Authorization', 'Bearer token'),
    patch: (id: string) => request(app).patch(`/api/favourites/${id}`).set('Authorization', 'Bearer token'),
    delete: (id: string) => request(app).delete(`/api/favourites/${id}`).set('Authorization', 'Bearer token'),
  }
}

describe('favourite routes', () => {
  it.each(['get', 'post', 'patch', 'delete'] as const)('requires authentication for %s', async (method) => {
    const { app, calls } = fixture()
    const path = method === 'patch' || method === 'delete' ? '/api/favourites/1' : '/api/favourites'
    await request(app)[method](path).expect(401, error('UNAUTHORIZED', 'Unauthorized'))
    expect(calls).toEqual([])
  })

  it('lists only rows for the authenticated user', async () => {
    const { app, calls } = fixture()
    await authorized(app).get().expect(200, [home])
    expect(calls).toEqual([['list', 'user-1']])
  })

  it('creates a favourite for the authenticated user', async () => {
    const { app, calls } = fixture()
    await authorized(app).post().send(input).expect(201, {
      ...home, id: 3, locationName: 'Work', address: 'Office', latitude: 1.4, longitude: 103.9,
    })
    expect(calls).toEqual([['create', 'user-1', { ...input, locationName: 'Work', address: 'Office' }]])
  })

  it('maps unique violation to duplicate favourite', async () => {
    const failure = Object.assign(new Error('duplicate'), { code: '23505' })
    const { app } = fixture({ create: async () => { throw failure } })
    await authorized(app).post().send(input).expect(409,
      error('FAVOURITE_ALREADY_EXISTS', 'Favourite already exists'))
  })

  it('renames an owned favourite', async () => {
    const { app, calls } = fixture()
    await authorized(app).patch('1').send({ locationName: ' New home ' }).expect(200, {
      ...home, locationName: 'New home',
    })
    expect(calls).toEqual([['rename', 'user-1', 1, { locationName: 'New home' }]])
  })

  it('deletes an owned favourite', async () => {
    const { app, rows, calls } = fixture()
    await authorized(app).delete('1').expect(204)
    expect(rows.has(1)).toBe(false)
    expect(calls).toEqual([['delete', 'user-1', 1]])
  })

  it.each(['patch', 'delete'] as const)('gives the same 404 for missing and other-user %s', async (method) => {
    const { app, rows } = fixture()
    const client = authorized(app)
    const responses = []
    for (const id of ['2', '999']) {
      const call = client[method](id)
      if (method === 'patch') call.send({ locationName: 'Changed' })
      responses.push(await call.expect(404, error('NOT_FOUND', 'Favourite not found')))
    }
    expect(responses[0]!.body).toEqual(responses[1]!.body)
    expect(rows.get(2)).toEqual(other)
  })

  it('rejects invalid input before gateway calls', async () => {
    const { app, calls } = fixture()
    await authorized(app).post().send({ ...input, latitude: 100 }).expect(400)
    await authorized(app).patch('1').send({ locationName: ' ' }).expect(400)
    await authorized(app).delete('0').expect(400)
    expect(calls).toEqual([])
  })

  it.each(['get', 'post', 'patch', 'delete'] as const)('returns 503 on %s gateway failure', async (method) => {
    const unavailable = async (): Promise<never> => { throw new Error('database unavailable') }
    const { app } = fixture({ list: unavailable, create: unavailable, rename: unavailable, delete: unavailable })
    const client = authorized(app)
    const call = method === 'get' ? client.get() : method === 'post' ? client.post().send(input)
      : method === 'patch' ? client.patch('1').send({ locationName: 'New' }) : client.delete('1')
    await call.expect(503, error('EXTERNAL_SERVICE_UNAVAILABLE', 'Favourites service unavailable'))
  })
})
