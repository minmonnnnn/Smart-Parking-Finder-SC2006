import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { AuthGatewayError, type AuthGateway } from './auth.types.js'
import { createRequireAuth } from './auth.middleware.js'
import { createAuthRouter } from './auth.routes.js'

const registration = {
  email: 'Driver@Example.com',
  password: 'Password1',
  name: 'Driver',
  vehicleType: 'EV',
}

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    register: async () => ({ userId: 'user-1' }),
    createProfile: async () => {},
    removeAuthUser: async () => {},
    login: async () => ({ userId: 'user-1', token: 'access-token' }),
    verifyToken: async () => ({ userId: 'user-1' }),
    getProfile: async () => null,
    updateProfile: async () => null,
    ...overrides,
  }
}

function appWithGateway(authGateway: AuthGateway) {
  return createApp({ auth: createAuthRouter({ gateway: authGateway }) })
}

describe('auth routes', () => {
  it('registers with normalized input and returns no token', async () => {
    let profileInput: unknown
    const authGateway = gateway({
      createProfile: async (userId, input) => { profileInput = { userId, ...input } },
    })
    const response = await request(appWithGateway(authGateway))
      .post('/api/auth/register')
      .send({ ...registration, email: ' Driver@Example.com ' })
      .expect(201)

    expect(response.body).toEqual({ userId: 'user-1', email: 'driver@example.com', name: 'Driver' })
    expect(JSON.stringify(response.body)).not.toContain('token')
    expect(profileInput).toEqual({ userId: 'user-1', name: 'Driver', vehicleType: 'EV' })
  })

  it('maps an existing account to 409', async () => {
    const authGateway = gateway({ register: async () => { throw new AuthGatewayError('ACCOUNT_EXISTS') } })
    await request(appWithGateway(authGateway)).post('/api/auth/register').send(registration).expect(409, {
      error: { code: 'ACCOUNT_ALREADY_EXISTS', message: 'Account already exists' },
    })
  })

  it('removes a newly created auth user when profile creation fails', async () => {
    const removed: string[] = []
    const authGateway = gateway({
      createProfile: async () => { throw new AuthGatewayError('UNAVAILABLE') },
      removeAuthUser: async (userId) => { removed.push(userId) },
    })
    await request(appWithGateway(authGateway)).post('/api/auth/register').send(registration).expect(503, {
      error: { code: 'EXTERNAL_SERVICE_UNAVAILABLE', message: 'Authentication service unavailable' },
    })
    expect(removed).toEqual(['user-1'])
  })

  it('returns user ID and token after login', async () => {
    const response = await request(appWithGateway(gateway()))
      .post('/api/auth/login')
      .send({ email: ' Driver@Example.com ', password: 'Password1' })
      .expect(200)
    expect(response.body).toEqual({ userId: 'user-1', token: 'access-token' })
  })

  it('maps bad credentials to 401 and outages to 503', async () => {
    const credentials = { email: 'driver@example.com', password: 'WrongPassword1' }
    const badCredentials = gateway({ login: async () => { throw new AuthGatewayError('INVALID_CREDENTIALS') } })
    await request(appWithGateway(badCredentials)).post('/api/auth/login').send(credentials).expect(401, {
      error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
    })
    const unavailable = gateway({ login: async () => { throw new AuthGatewayError('UNAVAILABLE') } })
    await request(appWithGateway(unavailable)).post('/api/auth/login').send(credentials).expect(503, {
      error: { code: 'EXTERNAL_SERVICE_UNAVAILABLE', message: 'Authentication service unavailable' },
    })
  })

  it('rejects invalid registration and login bodies', async () => {
    await request(appWithGateway(gateway()))
      .post('/api/auth/register')
      .send({ ...registration, password: 'weak' })
      .expect(400)
    await request(appWithGateway(gateway()))
      .post('/api/auth/login')
      .send({ email: 'bad-email', password: 'Password1' })
      .expect(400)
  })
})

describe('bearer authentication middleware', () => {
  function protectedApp(authGateway: AuthGateway) {
    const users = express.Router().get('/me', createRequireAuth(authGateway), (incoming, response) => {
      response.json(incoming.auth)
    })
    return createApp({ users })
  }

  it.each([undefined, '', 'token', 'Basic token', 'Bearer', 'Bearer ', 'Bearer one two', 'Bearer one, Bearer two'])(
    'rejects a missing or malformed bearer header %s',
    async (authorization) => {
      const call = request(protectedApp(gateway())).get('/api/users/me')
      if (authorization !== undefined) call.set('Authorization', authorization)
      await call.expect(401, { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    },
  )

  it('rejects an invalid token', async () => {
    const authGateway = gateway({ verifyToken: async () => null })
    await request(protectedApp(authGateway)).get('/api/users/me').set('Authorization', 'Bearer invalid')
      .expect(401, { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
  })

  it('rejects duplicate Authorization fields before verifying a token', async () => {
    let authorizationFields = 0
    let verificationCalls = 0
    const authGateway = gateway({
      verifyToken: async () => { verificationCalls += 1; return { userId: 'user-1' } },
    })
    const users = express.Router().get('/me', (incoming, _response, next) => {
      authorizationFields = incoming.rawHeaders.filter((header, index) =>
        index % 2 === 0 && header.toLowerCase() === 'authorization',
      ).length
      next()
    }, createRequireAuth(authGateway), (incoming, response) => {
      response.json(incoming.auth)
    })

    // Supertest sends array values as repeated fields, though its types only accept strings.
    const response = await request(createApp({ users })).get('/api/users/me')
      .set('Authorization', ['Bearer first', 'Bearer second'] as unknown as string)
    expect(authorizationFields).toBe(2)
    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    expect(verificationCalls).toBe(0)
  })

  it('attaches a verified user ID to the request', async () => {
    let receivedToken: string | undefined
    const authGateway = gateway({
      verifyToken: async (token) => { receivedToken = token; return { userId: 'verified-user' } },
    })
    await request(protectedApp(authGateway)).get('/api/users/me').set('Authorization', 'Bearer access-token')
      .expect(200, { userId: 'verified-user' })
    expect(receivedToken).toBe('access-token')
  })

  it('maps token verification outages to 503', async () => {
    const authGateway = gateway({ verifyToken: async () => { throw new AuthGatewayError('UNAVAILABLE') } })
    await request(protectedApp(authGateway)).get('/api/users/me').set('Authorization', 'Bearer access-token')
      .expect(503, { error: { code: 'EXTERNAL_SERVICE_UNAVAILABLE', message: 'Authentication service unavailable' } })
  })
})
