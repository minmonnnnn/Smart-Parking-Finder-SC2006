import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '../features/auth/AuthContext'
import { AUTH_STORAGE_KEY } from '../features/auth/authStorage'
import { ProfilePage } from './ProfilePage'

const profile = {
  id: 'driver-1',
  email: 'driver@example.com',
  name: 'Avery Tan',
  vehicleType: 'EV',
  createdAt: '2026-09-30T00:00:00.000Z',
}

function renderProfile(onAccountDeleted = vi.fn()) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: profile.id, token: 'session-token' }))
  render(<AuthProvider><ProfilePage onAccountDeleted={onAccountDeleted} /></AuthProvider>)
  return onAccountDeleted
}

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => { resolve = done })
  return { promise, resolve }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('ProfilePage', () => {
  it('shows loading until the profile arrives', async () => {
    const request = deferredResponse()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(request.promise))
    renderProfile()

    expect(screen.getByRole('status')).toHaveTextContent('Loading your profile')
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument()

    request.resolve(Response.json(profile))
    expect(await screen.findByDisplayValue('Avery Tan')).toBeInTheDocument()
  })

  it('lets a failed profile load be retried', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(profile))
    vi.stubGlobal('fetch', fetchMock)
    renderProfile()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your profile')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByDisplayValue('Avery Tan')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows name, read-only email, and vehicle type before editing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(profile)))
    renderProfile()

    expect(await screen.findByLabelText('Full name')).toHaveValue('Avery Tan')
    expect(screen.getByLabelText('Full name')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Email address')).toHaveValue('driver@example.com')
    expect(screen.getByLabelText('Email address')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Vehicle type')).toHaveValue('EV')
    expect(screen.getByLabelText('Vehicle type')).toBeDisabled()
  })

  it('restores original values when editing is cancelled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(profile)))
    renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    await user.click(screen.getByRole('button', { name: 'Edit profile' }))
    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), 'Changed name')
    await user.selectOptions(screen.getByLabelText('Vehicle type'), 'Hybrid')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByLabelText('Full name')).toHaveValue('Avery Tan')
    expect(screen.getByLabelText('Full name')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Vehicle type')).toHaveValue('EV')
    expect(screen.getByLabelText('Vehicle type')).toBeDisabled()
    expect(screen.getByLabelText('Email address')).toHaveAttribute('readonly')
  })

  it('saves trimmed name and vehicle type and then shows the updated profile', async () => {
    const updated = { ...profile, name: 'Avery Lee', vehicleType: 'Hybrid' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(profile))
      .mockResolvedValueOnce(Response.json(updated))
    vi.stubGlobal('fetch', fetchMock)
    renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    await user.click(screen.getByRole('button', { name: 'Edit profile' }))
    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), '  Avery Lee  ')
    await user.selectOptions(screen.getByLabelText('Vehicle type'), 'Hybrid')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.getByLabelText('Full name')).toHaveValue('Avery Lee'))
    expect(screen.getByLabelText('Full name')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Vehicle type')).toHaveValue('Hybrid')
    expect(screen.getByRole('status')).toHaveTextContent('Profile updated')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' })
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body)).toEqual({ name: 'Avery Lee', vehicleType: 'Hybrid' })

    await user.click(screen.getByRole('button', { name: 'Edit profile' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps the edit form and entered values after a failed update', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(profile))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    await user.click(screen.getByRole('button', { name: 'Edit profile' }))
    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), 'Avery Lee')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed')
    expect(screen.getByLabelText('Full name')).toHaveValue('Avery Lee')
    expect(screen.getByLabelText('Full name')).not.toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('validates an empty name without sending an update', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(profile))
    vi.stubGlobal('fetch', fetchMock)
    renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    await user.click(screen.getByRole('button', { name: 'Edit profile' }))
    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('opens an accessible confirmation and can cancel account deletion', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(profile))
    vi.stubGlobal('fetch', fetchMock)
    renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    const openButton = screen.getByRole('button', { name: 'Delete account' })
    await user.click(openButton)

    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    const focusStates: Array<{ dialogOpen: boolean; backgroundInert: boolean }> = []
    const originalFocus = openButton.focus.bind(openButton)
    vi.spyOn(openButton, 'focus').mockImplementation(() => {
      focusStates.push({ dialogOpen: !!screen.queryByRole('dialog'), backgroundInert: openButton.closest('.profile-panel')?.hasAttribute('inert') ?? false })
      originalFocus()
    })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(openButton).toHaveFocus()
    expect(focusStates).toEqual([{ dialogOpen: false, backgroundInert: false }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns focus after Cancel closes the confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(profile)))
    renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    const openButton = screen.getByRole('button', { name: 'Delete account' })
    await user.click(openButton)
    const focusStates: Array<{ dialogOpen: boolean; backgroundInert: boolean }> = []
    const originalFocus = openButton.focus.bind(openButton)
    vi.spyOn(openButton, 'focus').mockImplementation(() => {
      focusStates.push({ dialogOpen: !!screen.queryByRole('dialog'), backgroundInert: openButton.closest('.profile-panel')?.hasAttribute('inert') ?? false })
      originalFocus()
    })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(openButton).toHaveFocus()
    expect(focusStates).toEqual([{ dialogOpen: false, backgroundInert: false }])
  })

  it('keeps Tab focus inside the confirmation dialog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(profile)))
    renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    const dialog = screen.getByRole('dialog')
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = dialog.querySelector('button[type="submit"]')!

    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    expect(screen.getByRole('main').querySelector('section')).toHaveAttribute('inert')
  })

  it('calls completion only after deletion succeeds and blocks repeat deletion', async () => {
    const deletion = deferredResponse()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(profile))
      .mockReturnValueOnce(deletion.promise)
    vi.stubGlobal('fetch', fetchMock)
    const onAccountDeleted = renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.click(screen.getByRole('dialog').querySelector('button[type="submit"]')!)

    expect(screen.getByRole('button', { name: 'Deleting account…' })).toBeDisabled()
    expect(onAccountDeleted).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    deletion.resolve(new Response(null, { status: 204 }))
    await waitFor(() => expect(onAccountDeleted).toHaveBeenCalledTimes(1))
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('keeps the profile and session visible when deletion fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(profile))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const onAccountDeleted = renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.click(screen.getByRole('dialog').querySelector('button[type="submit"]')!)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete your account')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toHaveValue('Avery Tan')
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()
    expect(onAccountDeleted).not.toHaveBeenCalled()
  })

  it('keeps keyboard focus in the pending dialog and restores Cancel after failure', async () => {
    const deletion = deferredResponse()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(profile)).mockReturnValueOnce(deletion.promise))
    renderProfile()
    const user = userEvent.setup()
    await screen.findByDisplayValue('Avery Tan')
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.click(screen.getByRole('dialog').querySelector('button[type="submit"]')!)

    expect(screen.getByRole('dialog')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('dialog')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    deletion.resolve(new Response(null, { status: 503 }))
    await screen.findByRole('alert')
    await waitFor(() => {expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()})
    await user.tab({ shift: true })
    expect(screen.getByRole('dialog').querySelector('button[type="submit"]')).toHaveFocus()
  })
})
