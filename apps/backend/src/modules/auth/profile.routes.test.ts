import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { User } from '@smart-parking/shared-types'
import { createApp } from '../../app.js'
import { AuthGatewayError, type AuthGateway } from './auth.types.js'
import { createUsersRouter } from './auth.routes.js'

const profile: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver',
  vehicleType: 'EV',
  createdAt: '2026-09-30T00:00:00.000Z',
}

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  const result = {
    register: async () => ({ userId: 'user-1' }),
    createProfile: async () => {},
    removeAuthUser: async () => {},
    login: async () => ({ userId: 'user-1', token: 'token' }),
    verifyToken: async () => ({ userId: 'user-1' }),
    getProfile: async () => profile,
    updateProfile: async () => profile,
    ...overrides,
  }
  return result
}

function appWithGateway(authGateway: AuthGateway) {
  return createApp({ users: createUsersRouter({ gateway: authGateway }) })
}

const authorized = (app: ReturnType<typeof appWithGateway>) => request(app)
  .get('/api/users/me').set('Authorization', 'Bearer token')

describe('profile routes', () => {
  it.each(['get', 'put', 'delete'] as const)('requires authentication for %s', async (method) => {
    await request(appWithGateway(gateway()))[method]('/api/users/me').expect(401, {
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    })
  })

  it('returns the authenticated user profile', async () => {
    const received: string[] = []
    const authGateway = gateway({ getProfile: async (userId) => { received.push(userId); return profile } })
    await authorized(appWithGateway(authGateway)).expect(200, profile)
    expect(received).toEqual(['user-1'])
  })

  it('updates a nonempty partial profile and returns the updated user', async () => {
    const received: unknown[] = []
    const updated = { ...profile, name: 'New Driver' }
    const authGateway = gateway({
      updateProfile: async (userId, patch) => { received.push({ userId, patch }); return updated },
    })
    await request(appWithGateway(authGateway)).put('/api/users/me')
      .set('Authorization', 'Bearer token').send({ name: ' New Driver ' })
      .expect(200, updated)
    expect(received).toEqual([{ userId: 'user-1', patch: { name: 'New Driver' } }])
  })

  it('rejects an empty profile update before calling the gateway', async () => {
    let updates = 0
    const authGateway = gateway({ updateProfile: async () => { updates += 1; return profile } })
    await request(appWithGateway(authGateway)).put('/api/users/me')
      .set('Authorization', 'Bearer token').send({})
      .expect(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } })
    expect(updates).toBe(0)
  })

  it('deletes only the authenticated auth user and returns 204', async () => {
    const removed: string[] = []
    const authGateway = gateway({
      getProfile: async () => { throw new Error('profile lookup must not run') },
      updateProfile: async () => { throw new Error('profile update must not run') },
      removeAuthUser: async (userId) => { removed.push(userId) },
    })
    await request(appWithGateway(authGateway)).delete('/api/users/me')
      .set('Authorization', 'Bearer token').expect(204)
    expect(removed).toEqual(['user-1'])
  })

  it.each(['get', 'put'] as const)('returns 404 when %s finds no profile', async (method) => {
    const authGateway = gateway({ getProfile: async () => null, updateProfile: async () => null })
    const call = request(appWithGateway(authGateway))[method]('/api/users/me')
      .set('Authorization', 'Bearer token')
    if (method === 'put') call.send({ vehicleType: 'Hybrid' })
    await call.expect(404, { error: { code: 'NOT_FOUND', message: 'Profile not found' } })
  })

  it.each(['get', 'put', 'delete'] as const)('returns 503 on %s gateway outage', async (method) => {
    const unavailable = async (): Promise<never> => { throw new AuthGatewayError('UNAVAILABLE') }
    const authGateway = gateway({
      getProfile: unavailable,
      updateProfile: unavailable,
      removeAuthUser: unavailable,
    })
    const call = request(appWithGateway(authGateway))[method]('/api/users/me')
      .set('Authorization', 'Bearer token')
    if (method === 'put') call.send({ name: 'Driver' })
    await call.expect(503, {
      error: { code: 'EXTERNAL_SERVICE_UNAVAILABLE', message: 'Authentication service unavailable' },
    })
  })
})
