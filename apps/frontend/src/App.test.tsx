import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AUTH_STORAGE_KEY } from './features/auth/authStorage'

const profile = { id: 'driver-1', email: 'driver@example.com', name: 'Avery Tan', vehicleType: 'EV', createdAt: '2026-09-30T00:00:00.000Z' }
const home = { id: 7, userId: profile.id, locationName: 'Home', address: '1 Main St', latitude: 1.3, longitude: 103.8, createdAt: profile.createdAt }

function mockApi(favourites = [home]) {
  vi.stubEnv('VITE_API_BASE_URL', '')
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    if (path === '/api/auth/login') return Response.json({ userId: profile.id, token: 'session-token' })
    if (path === '/api/users/me') return options?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json(profile)
    if (path === '/api/favourites') return Response.json(favourites)
    throw new Error(`Unexpected request: ${path}`)
  }))
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('App flow', () => {
  it('switches auth pages, signs in, selects a favourite for search, and logs out', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByRole('heading', { name: 'Start parking smarter.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await user.type(screen.getByLabelText('Email address'), profile.email)
    await user.type(screen.getByLabelText('Password', { exact: true }), 'Password1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByDisplayValue(profile.name)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your profile.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Favourites' }))
    await user.click(await screen.findByRole('button', { name: 'Use Home as destination' }))
    expect(screen.getByRole('status')).toHaveTextContent('Selected Home (1 Main St).')
    await user.click(screen.getByRole('button', { name: 'Profile' }))
    expect(screen.getByRole('heading', { name: 'Your profile.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(screen.queryByText(/Selected Home/)).not.toBeInTheDocument()
  })

  it('restores a saved session to Profile and returns to sign in after account deletion', async () => {
    mockApi()
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: profile.id, token: 'session-token' }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByDisplayValue(profile.name)
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete account' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('gives an explicit search handoff from empty favourites', async () => {
    mockApi([])
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: profile.id, token: 'session-token' }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByDisplayValue(profile.name)
    await user.click(screen.getByRole('button', { name: 'Favourites' }))
    await user.click(await screen.findByRole('button', { name: 'Search destinations' }))
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('textbox', { name: 'Destination' })).toBeInTheDocument()})
  })
