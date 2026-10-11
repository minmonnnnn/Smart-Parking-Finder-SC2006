import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, ApiClientError } from './apiClient'

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('prefixes the API base URL and sends JSON headers and bearer token', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest<{ ok: boolean }>('/api/users/me', { token: 'session-token' }))
      .resolves.toEqual({ ok: true })
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/users/me')
    expect(new Headers(options.headers).get('Content-Type')).toBe('application/json')
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer session-token')
  })

  it.each([null, [], { error: null }, { error: { code: 401, message: {} } }])(
    'throws a typed client error for malformed error bodies: %j', async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status: 502 })))

      const request = apiRequest('/api/users/me')
      await expect(request).rejects.toBeInstanceOf(ApiClientError)
      await expect(request).rejects.toMatchObject({
        status: 502,
        code: 'INTERNAL_ERROR',
        message: 'Request failed',
      })
    },
  )

  it('returns undefined for 204 without parsing JSON', async () => {
    const response = new Response(null, { status: 204 })
    const json = vi.spyOn(response, 'json')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await expect(apiRequest<void>('/api/users/me', { method: 'DELETE' })).resolves.toBeUndefined()
    expect(json).not.toHaveBeenCalled()
  })

  it('throws an ApiClientError with the safe API error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))

    const request = apiRequest('/api/users/me')
    await expect(request).rejects.toBeInstanceOf(ApiClientError)
    await expect(request).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' })
  })
})
