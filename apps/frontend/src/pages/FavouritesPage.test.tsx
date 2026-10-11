import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../features/auth/AuthContext'
import { AUTH_STORAGE_KEY } from '../features/auth/authStorage'
import { FavouritesPage } from './FavouritesPage'

const home = { id: 7, userId: 'driver-1', locationName: 'Home', address: '1 Main St', latitude: 1.3, longitude: 103.8, createdAt: '2026-09-30T00:00:00.000Z' }
const office = { ...home, id: 8, locationName: 'Office', address: '2 Main St', latitude: 1.4, longitude: 103.9 }
const profile = { id: 'driver-1', email: 'driver@example.com', name: 'Avery Tan', vehicleType: 'EV', createdAt: home.createdAt }

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => { resolve = done })
  return { promise, resolve }
}

function setFetch(favourites: typeof home[] | Promise<Response> = [home, office]) {
  const fetchMock = vi.fn((path: string, options?: RequestInit) => {
    if (path === '/api/users/me') return Promise.resolve(Response.json(profile))
    if (path === '/api/favourites' && (!options?.method || options.method === 'GET')) {
      return favourites instanceof Promise ? favourites : Promise.resolve(Response.json(favourites))
    }
    return Promise.resolve(new Response(null, { status: 204 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(onSelect = vi.fn(), onSearch = vi.fn()) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'driver-1', token: 'session-token' }))
  render(<AuthProvider><FavouritesPage onSelect={onSelect} onSearch={onSearch} /></AuthProvider>)
  return { onSelect, onSearch }
}

function SwitchSession() {
  const { login } = useAuth()
  return <button type="button" onClick={() => void login({ email: 'driver-b@example.com', password: 'password' })}>Switch session</button>
}

function renderPageWithSessionSwitch() {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'driver-a', token: 'token-a' }))
  render(<AuthProvider><SwitchSession /><FavouritesPage onSelect={vi.fn()} onSearch={vi.fn()} /></AuthProvider>)
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('FavouritesPage', () => {
  it('shows loading until favourites arrive', async () => {
    const request = deferredResponse()
    setFetch(request.promise)
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Loading saved locations')
    request.resolve(Response.json([home]))
    expect(await screen.findByText('1 Main St')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
  })

  it('shows an empty state with a search action', async () => {
    setFetch([])
    const { onSearch } = renderPage()
    const user = userEvent.setup()
    await screen.findByText('No saved locations yet')
    await user.click(screen.getByRole('button', { name: 'Search destinations' }))
    expect(onSearch).toHaveBeenCalledOnce()
  })

  it('selects the full favourite including coordinates', async () => {
    setFetch()
    const { onSelect } = renderPage()
    const user = userEvent.setup()
    await screen.findByText('1 Main St')
    await user.click(screen.getByRole('button', { name: 'Use Home as destination' }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(home)
  })

  it('renames inline, saves a trimmed name, and supports cancel', async () => {
    const fetchMock = setFetch()
    fetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/api/users/me') return Promise.resolve(Response.json(profile))
      if (path === '/api/favourites' && !options?.method) return Promise.resolve(Response.json([home]))
      if (path === '/api/favourites/7' && options?.method === 'PATCH') return Promise.resolve(Response.json({ ...home, locationName: 'New home' }))
      return Promise.resolve(new Response(null, { status: 404 }))
    })
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('1 Main St')
    await user.click(screen.getByRole('button', { name: 'Rename Home' }))
    await user.clear(screen.getByRole('textbox', { name: 'Location name' }))
    await user.type(screen.getByRole('textbox', { name: 'Location name' }), '  New home  ')
    await user.click(screen.getByRole('button', { name: 'Cancel rename' }))
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rename Home' }))
    await user.clear(screen.getByRole('textbox', { name: 'Location name' }))
    await user.type(screen.getByRole('textbox', { name: 'Location name' }), '  New home  ')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(await screen.findByRole('heading', { name: 'New home' })).toBeInTheDocument()
    const renameCall = fetchMock.mock.calls.find(([path, options]) => path === '/api/favourites/7' && options?.method === 'PATCH')
    expect(JSON.parse(renameCall?.[1]?.body as string)).toEqual({ locationName: 'New home' })
  })

  it('confirms deletion, hides the item, and Undo restores it without DELETE', async () => {
    vi.useFakeTimers()
    const fetchMock = setFetch([home])
    renderPage()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Home' }))
    expect(screen.getByRole('dialog', { name: 'Delete Home?' })).toHaveAttribute('aria-modal', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deletion' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('1 Main St')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    expect(screen.queryByText('1 Main St')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Home removed')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('1 Main St')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0)
  })

  it('restores an item when deletion returns an ownership-safe missing-item error', async () => {
    vi.useFakeTimers()
    const fetchMock = setFetch([home])
    fetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/api/users/me') return Promise.resolve(Response.json(profile))
      if (path === '/api/favourites') return Promise.resolve(Response.json([home]))
      if (options?.method === 'DELETE') return Promise.resolve(Response.json({ error: { code: 'NOT_FOUND', message: 'Favourite not found' } }, { status: 404 }))
      return Promise.resolve(new Response(null, { status: 500 }))
    })
    renderPage()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(screen.getByText('1 Main St')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Favourite not found')
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
  })

  it('shows the empty state after the last item is deleted', async () => {
    vi.useFakeTimers()
    const fetchMock = setFetch([home])
    renderPage()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    await act(async () => vi.advanceTimersByTimeAsync(5000))

    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
    expect(screen.getByText('No saved locations yet')).toBeInTheDocument()
  })

  it('keeps a failed rename editable and reports the missing item', async () => {
    const fetchMock = setFetch([home])
    fetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/api/users/me') return Promise.resolve(Response.json(profile))
      if (path === '/api/favourites') return Promise.resolve(Response.json([home]))
      if (options?.method === 'PATCH') return Promise.resolve(Response.json({ error: { code: 'NOT_FOUND', message: 'Favourite not found' } }, { status: 404 }))
      return Promise.resolve(new Response(null, { status: 500 }))
    })
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('1 Main St')
    await user.click(screen.getByRole('button', { name: 'Rename Home' }))
    await user.clear(screen.getByRole('textbox', { name: 'Location name' }))
    await user.type(screen.getByRole('textbox', { name: 'Location name' }), 'New home')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Favourite not found')
    expect(screen.getByRole('textbox', { name: 'Location name' })).toHaveValue('New home')
  })

  it('retries retrieval after failure', async () => {
    const fetchMock = setFetch()
    let attempts = 0
    fetchMock.mockImplementation((path: string) => {
      if (path === '/api/users/me') return Promise.resolve(Response.json(profile))
      attempts += 1
      return Promise.resolve(attempts === 1 ? new Response(null, { status: 503 }) : Response.json([home]))
    })
    renderPage()
    const user = userEvent.setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load saved locations')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('1 Main St')).toBeInTheDocument())
    expect(attempts).toBe(2)
  })

  it('keeps the newer session list when the previous GET resolves last', async () => {
    const firstList = deferredResponse()
    const fetchMock = vi.fn((path: string, options?: RequestInit) => {
      if (path === '/api/auth/login') return Promise.resolve(Response.json({ userId: 'driver-b', token: 'token-b' }))
      if (path === '/api/users/me') return Promise.resolve(Response.json(profile))
      if (path === '/api/favourites') return options?.headers instanceof Headers && options.headers.get('Authorization') === 'Bearer token-a'
        ? firstList.promise : Promise.resolve(Response.json([office]))
      return Promise.resolve(new Response(null, { status: 500 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPageWithSessionSwitch()
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => path === '/api/favourites')).toBe(true))

    await userEvent.click(screen.getByRole('button', { name: 'Switch session' }))
    expect(await screen.findByText('2 Main St')).toBeInTheDocument()
    firstList.resolve(Response.json([home]))
    await act(async () => { await firstList.promise; await Promise.resolve() })
    expect(screen.getByText('2 Main St')).toBeInTheDocument()
    expect(screen.queryByText('1 Main St')).not.toBeInTheDocument()
  })

  it('cancels a pending Undo deletion when the token changes', async () => {
    const fetchMock = vi.fn((path: string, options?: RequestInit) => {
      if (path === '/api/auth/login') return Promise.resolve(Response.json({ userId: 'driver-b', token: 'token-b' }))
      if (path === '/api/users/me') return Promise.resolve(Response.json(profile))
      if (path === '/api/favourites') return Promise.resolve(Response.json(options?.headers instanceof Headers && options.headers.get('Authorization') === 'Bearer token-a' ? [home] : [office]))
      return Promise.resolve(new Response(null, { status: 204 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPageWithSessionSwitch()
    await screen.findByText('1 Main St')
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Switch session' }))
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('2 Main St')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0)
  })
})
