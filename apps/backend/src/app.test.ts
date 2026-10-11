import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { ApiException } from './lib/errors/index.js'

const fakeDependencies = {}

describe('createApp', () => {
  it('allows a configured frontend origin and rejects the previous local origin', async () => {
    const app = createApp({ frontendOrigin: 'https://parking.example' })
    const allowed = await request(app).options('/api/users/me')
      .set('Origin', 'https://parking.example')
      .set('Access-Control-Request-Method', 'PUT').expect(204)
    expect(allowed.headers['access-control-allow-origin']).toBe('https://parking.example')
    const denied = await request(app).get('/health').set('Origin', 'http://localhost:5173').expect(200)
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('serves health without constructing live Supabase dependencies', async () => {
    await request(createApp(fakeDependencies)).get('/health').expect(200, { ok: true })
  })

  it('allows cross-origin browser requests', async () => {
    const response = await request(createApp(fakeDependencies))
      .get('/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200)

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('allows browser preflight from the configured frontend origin', async () => {
    const response = await request(createApp(fakeDependencies))
      .options('/api/users/me')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204)

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('does not allow browser requests from other origins', async () => {
    const response = await request(createApp(fakeDependencies))
      .get('/health')
      .set('Origin', 'https://untrusted.example')
      .expect(200)

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('mounts injected feature routers under their API paths', async () => {
    const auth = express.Router().post('/login', (_request, response) => {
      response.json({ reached: 'auth' })
    })
    const users = express.Router().get('/me', (_request, response) => {
      response.json({ reached: 'users' })
    })
    const favourites = express.Router().get('/', (_request, response) => {
      response.json({ reached: 'favourites' })
    })
    const app = createApp({ auth, users, favourites })

    await request(app).post('/api/auth/login').expect(200, { reached: 'auth' })
    await request(app).get('/api/users/me').expect(200, { reached: 'users' })
    await request(app).get('/api/favourites').expect(200, { reached: 'favourites' })
  })

  it('parses JSON for injected routers', async () => {
    const auth = express.Router().post('/echo', (incoming, response) => {
      response.json(incoming.body)
    })

    await request(createApp({ auth }))
      .post('/api/auth/echo')
      .send({ email: 'driver@example.com' })
      .expect(200, { email: 'driver@example.com' })
  })

  it('returns the shared error shape for missing routes', async () => {
    await request(createApp(fakeDependencies))
      .get('/does-not-exist')
      .expect(404, { error: { code: 'NOT_FOUND', message: 'Not found' } })
  })

  it('rejects malformed JSON with a safe validation error', async () => {
    await request(createApp(fakeDependencies)).post('/api/auth/login')
      .set('Content-Type', 'application/json').send('{"password":"private-value"')
      .expect(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } })
  })

  it('serializes known exceptions with optional details', async () => {
    const auth = express.Router().get('/fail', () => {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Invalid email', { field: 'email' })
    })

    await request(createApp({ auth })).get('/api/auth/fail').expect(422, {
      error: { code: 'VALIDATION_ERROR', message: 'Invalid email', details: { field: 'email' } },
    })
  })

  it('hides unknown error details', async () => {
    const auth = express.Router().get('/fail', () => {
      throw new Error('secret failure')
    })

    const response = await request(createApp({ auth })).get('/api/auth/fail').expect(500)
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  })

  it('omits optional exception details in production', async () => {
    const auth = express.Router().get('/fail', () => {
      throw new ApiException(400, 'VALIDATION_ERROR', 'Invalid input', { private: 'provider detail' })
    })
    const app = createApp({ auth })
    app.set('env', 'production')
    await request(app).get('/api/auth/fail').expect(400, {
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
    })
  })
})
