import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './AuthContext'
import { AUTH_STORAGE_KEY } from './authStorage'

const profile = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver',
  vehicleType: 'EV' as const,
  createdAt: '2026-09-30T00:00:00.000Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function responseWithSettledJson(body: unknown, onSettled: () => void): Response {
  const response = Response.json(body)
  const parseJson = response.json.bind(response)
  vi.spyOn(response, 'json').mockImplementation(async () => {
    const value = await parseJson()
    onSettled()
    return value
  })
  return response
}

function Harness() {
  const auth = useAuth()
  const [operation, setOperation] = useState('idle')
  return <>
    <output data-testid="session">{auth.session?.userId ?? 'signed-out'}</output>
    <output data-testid="profile">{auth.profile?.name ?? 'no-profile'}</output>
    <output data-testid="loading">{auth.loading ? 'loading' : 'idle'}</output>
    <output data-testid="operation">{operation}</output>
    <button onClick={() => void auth.register({ email: profile.email, password: 'secret', name: profile.name, vehicleType: 'EV' }).then(() => setOperation('registered'), () => setOperation('register-failed'))}>register</button>
    <button onClick={() => void auth.login({ email: profile.email, password: 'secret' }).then(() => setOperation('login-settled'), () => setOperation('login-failed'))}>login</button>
    <button onClick={() => void auth.login({ email: 'second@example.com', password: 'secret' }).then(() => setOperation('login-settled'), () => setOperation('login-failed'))}>switch-account</button>
    <button onClick={() => void auth.logout()}>logout</button>
    <button onClick={() => void auth.deleteAccount().then(() => setOperation('deleted'), () => setOperation('delete-failed'))}>delete</button>
  </>
}

function renderAuth() {
  return render(<AuthProvider><Harness /></AuthProvider>)
}

describe('AuthContext', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('removes malformed persisted JSON', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{broken')
    renderAuth()
    await waitFor(() => expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull())
  })

  it('keeps only userId and token in persisted session data', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      userId: 'user-1', token: 'secret-token', password: 'must-not-persist',
    }))
    renderAuth()

    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}')).toEqual({
      userId: 'user-1', token: 'secret-token',
    })
  })

  it('stores only the session returned by login', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ userId: 'user-1', token: 'secret-token' }))
      .mockResolvedValueOnce(Response.json(profile)))
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByText('login'))

    await waitFor(() => expect(screen.getByTestId('profile')).toHaveTextContent('Driver'))
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}')).toEqual({ userId: 'user-1', token: 'secret-token' })
  })

  it('does not authenticate after registration', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(
      { userId: 'user-1', email: profile.email, name: profile.name }, { status: 201 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByText('register'))

    await waitFor(() => expect(screen.getByTestId('operation')).toHaveTextContent('registered'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/register')
    expect(screen.getByTestId('session')).toHaveTextContent('signed-out')
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('clears session on logout', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'user-1', token: 'secret-token' }))
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByText('logout'))

    expect(screen.getByTestId('session')).toHaveTextContent('signed-out')
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('preserves the session when account deletion fails', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'user-1', token: 'secret-token' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(profile))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByText('delete'))

    await waitFor(() => expect(screen.getByTestId('operation')).toHaveTextContent('delete-failed'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' })
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe('Bearer secret-token')
    expect(screen.getByTestId('session')).toHaveTextContent('user-1')
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}')).toEqual({ userId: 'user-1', token: 'secret-token' })
  })

  it('keeps an existing profile load valid when login fails', async () => {
    const profileResponse = deferred<Response>()
    const fetchMock = vi.fn()
      .mockReturnValueOnce(profileResponse.promise)
      .mockResolvedValueOnce(Response.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'user-1', token: 'secret-token' }))
    const user = userEvent.setup()
    renderAuth()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getByText('login'))
    await waitFor(() => expect(screen.getByTestId('operation')).toHaveTextContent('login-failed'))
    const profileSettled = deferred<void>()
    await act(async () => {
      profileResponse.resolve(responseWithSettledJson(profile, profileSettled.resolve))
      await profileSettled.promise
      await Promise.resolve()
    })

    expect(screen.getByTestId('session')).toHaveTextContent('user-1')
    expect(screen.getByTestId('profile')).toHaveTextContent('Driver')
  })

  it('keeps an existing profile load valid when account deletion fails', async () => {
    const profileResponse = deferred<Response>()
    const fetchMock = vi.fn()
      .mockReturnValueOnce(profileResponse.promise)
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'user-1', token: 'secret-token' }))
    const user = userEvent.setup()
    renderAuth()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getByText('delete'))
    await waitFor(() => expect(screen.getByTestId('operation')).toHaveTextContent('delete-failed'))
    const profileSettled = deferred<void>()
    await act(async () => {
      profileResponse.resolve(responseWithSettledJson(profile, profileSettled.resolve))
      await profileSettled.promise
      await Promise.resolve()
    })

    expect(screen.getByTestId('session')).toHaveTextContent('user-1')
    expect(screen.getByTestId('profile')).toHaveTextContent('Driver')
  })

  it('ignores a profile response that arrives after logout', async () => {
    const profileResponse = deferred<Response>()
    const fetchMock = vi.fn().mockReturnValue(profileResponse.promise)
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'user-1', token: 'secret-token' }))
    const user = userEvent.setup()
    renderAuth()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getByText('logout'))
    const responseSettled = deferred<void>()
    await act(async () => {
      profileResponse.resolve(responseWithSettledJson(profile, responseSettled.resolve))
      await responseSettled.promise
      await Promise.resolve()
    })

    expect(screen.getByTestId('session')).toHaveTextContent('signed-out')
    expect(screen.getByTestId('profile')).toHaveTextContent('no-profile')
  })

  it('ignores a profile response that arrives after successful account deletion', async () => {
    const profileResponse = deferred<Response>()
    const fetchMock = vi.fn()
      .mockReturnValueOnce(profileResponse.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'user-1', token: 'secret-token' }))
    const user = userEvent.setup()
    renderAuth()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getByText('delete'))
    await waitFor(() => expect(screen.getByTestId('operation')).toHaveTextContent('deleted'))
    const responseSettled = deferred<void>()
    await act(async () => {
      profileResponse.resolve(responseWithSettledJson(profile, responseSettled.resolve))
      await responseSettled.promise
      await Promise.resolve()
    })

    expect(screen.getByTestId('session')).toHaveTextContent('signed-out')
    expect(screen.getByTestId('profile')).toHaveTextContent('no-profile')
  })

  it('ignores a profile response from the previous account', async () => {
    const firstProfile = deferred<Response>()
    let profileRequests = 0
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/users/me')) {
        profileRequests += 1
        return profileRequests === 1 ? firstProfile.promise : Promise.resolve(Response.json({ ...profile, id: 'user-2', name: 'Second' }))
      }
      if (url.endsWith('/api/auth/login')) {
        return Promise.resolve(Response.json({ userId: 'user-2', token: 'second-token' }))
      }
      return Promise.reject(new Error(`Unexpected request ${url} ${init?.method ?? 'GET'}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'user-1', token: 'first-token' }))
    const user = userEvent.setup()
    renderAuth()
    await waitFor(() => expect(profileRequests).toBe(1))

    await user.click(screen.getByText('switch-account'))
    await waitFor(() => expect(screen.getByTestId('profile')).toHaveTextContent('Second'))
    const responseSettled = deferred<void>()
    await act(async () => {
      firstProfile.resolve(responseWithSettledJson(profile, responseSettled.resolve))
      await responseSettled.promise
      await Promise.resolve()
    })

    expect(screen.getByTestId('session')).toHaveTextContent('user-2')
    expect(screen.getByTestId('profile')).toHaveTextContent('Second')
  })

  it('does not accept a login response that arrives after logout', async () => {
    const loginResponse = deferred<Response>()
    const responseSettled = deferred<void>()
    const fetchMock = vi.fn().mockReturnValue(loginResponse.promise)
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByText('login'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await user.click(screen.getByText('logout'))
    await act(async () => {
      loginResponse.resolve(responseWithSettledJson({ userId: 'user-1', token: 'late-token' }, responseSettled.resolve))
      await responseSettled.promise
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByTestId('operation')).toHaveTextContent('login-settled'))

    expect(screen.getByTestId('session')).toHaveTextContent('signed-out')
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('ignores an older login response after a newer login succeeds', async () => {
    const firstLogin = deferred<Response>()
    const secondLogin = deferred<Response>()
    const firstSettled = deferred<void>()
    const secondSettled = deferred<void>()
    let loginRequests = 0
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/auth/login')) {
        loginRequests += 1
        return loginRequests === 1 ? firstLogin.promise : secondLogin.promise
      }
      if (String(input).endsWith('/api/users/me')) {
        return Promise.resolve(Response.json({ ...profile, id: 'user-2', name: 'Second' }))
      }
      return Promise.reject(new Error(`Unexpected request ${String(input)}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByText('login'))
    await waitFor(() => expect(loginRequests).toBe(1))
    await user.click(screen.getByText('switch-account'))
    await waitFor(() => expect(loginRequests).toBe(2))
    await act(async () => {
      secondLogin.resolve(responseWithSettledJson({ userId: 'user-2', token: 'second-token' }, secondSettled.resolve))
      await secondSettled.promise
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('user-2'))
    await act(async () => {
      firstLogin.resolve(responseWithSettledJson({ userId: 'user-1', token: 'first-token' }, firstSettled.resolve))
      await firstSettled.promise
      await Promise.resolve()
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(screen.getByTestId('profile')).toHaveTextContent('Second'))

    expect(screen.getByTestId('session')).toHaveTextContent('user-2')
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}')).toEqual({ userId: 'user-2', token: 'second-token' })
  })
})
