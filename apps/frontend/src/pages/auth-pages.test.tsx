import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '../features/auth/AuthContext'
import { SignInPage } from './SignInPage'
import { SignUpPage } from './SignUpPage'

function renderPage(page: React.ReactNode) {
  return render(<AuthProvider>{page}</AuthProvider>)
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('SignInPage', () => {
  it('labels fields and toggles password visibility', async () => {
    renderPage(<SignInPage onSignedIn={vi.fn()} onSwitchMode={vi.fn()} />)
    const password = screen.getByLabelText('Password')
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(password).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' }).querySelector('svg')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('validates before sending a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<SignInPage onSignedIn={vi.fn()} onSwitchMode={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your password')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits trimmed email, blocks duplicate submission, and calls back on success', async () => {
    let resolve!: (response: Response) => void
    const pending = new Promise<Response>((done) => { resolve = done })
    const fetchMock = vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(Response.json({ id: 'driver-1', email: 'driver@example.com', name: 'Driver', vehicleType: 'EV', createdAt: '2026-09-30' }))
    vi.stubGlobal('fetch', fetchMock)
    const onSignedIn = vi.fn()
    renderPage(<SignInPage onSignedIn={onSignedIn} onSwitchMode={vi.fn()} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email address'), ' Driver@Example.com ')
    await user.type(screen.getByLabelText('Password'), 'Password1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)).toEqual({ email: 'driver@example.com', password: 'Password1' })
    resolve(Response.json({ userId: 'driver-1', token: 'session-token' }))
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1))
  })

  it('renders a backend error as text and offers the sign-up callback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'UNAUTHORIZED', message: '<img src=x onerror=alert(1)> Incorrect credentials' } }, { status: 401 })))
    const onSwitchMode = vi.fn()
    renderPage(<SignInPage onSignedIn={vi.fn()} onSwitchMode={onSwitchMode} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email address'), 'driver@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect credentials')
    expect(document.querySelector('img')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(onSwitchMode).toHaveBeenCalledTimes(1)
  })
})

describe('SignUpPage', () => {
  it('labels fields and offers exactly the supported vehicle types', () => {
    renderPage(<SignUpPage onSwitchMode={vi.fn()} />)
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' }).querySelector('svg')).toBeInTheDocument()
    expect(screen.getByLabelText('Vehicle type')).toBeInTheDocument()
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Select vehicle type', 'EV', 'Petrol', 'Hybrid'])
  })

  it('validates all registration fields before sending a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<SignUpPage onSwitchMode={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address')
    expect(screen.getByRole('alert')).toHaveTextContent('Choose your vehicle type')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a weak password before registration', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<SignUpPage onSwitchMode={vi.fn()} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Full name'), 'Driver')
    await user.type(screen.getByLabelText('Email address'), 'driver@example.com')
    await user.type(screen.getByLabelText('Password'), 'weak')
    await user.selectOptions(screen.getByLabelText('Vehicle type'), 'EV')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 8 characters with uppercase, lowercase, and a number')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends registration payload and confirms before switching to sign-in', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ userId: 'driver-1', email: 'driver@example.com', name: 'Driver' }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const onSwitchMode = vi.fn()
    renderPage(<SignUpPage onSwitchMode={onSwitchMode} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Full name'), ' Driver ')
    await user.type(screen.getByLabelText('Email address'), ' Driver@Example.com ')
    await user.type(screen.getByLabelText('Password'), 'Password1')
    await user.selectOptions(screen.getByLabelText('Vehicle type'), 'Hybrid')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)).toEqual({ name: 'Driver', email: 'driver@example.com', password: 'Password1', vehicleType: 'Hybrid' })
    expect(await screen.findByText('Account created')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Account created')
    expect(screen.getByRole('heading', { name: 'Account created' })).toHaveFocus()
    expect(onSwitchMode).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Continue to sign in' }))
    expect(onSwitchMode).toHaveBeenCalledTimes(1)
  })

  it('disables registration while the request is pending', async () => {
    let resolve!: (response: Response) => void
    const pending = new Promise<Response>((done) => { resolve = done })
    const fetchMock = vi.fn().mockReturnValue(pending)
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<SignUpPage onSwitchMode={vi.fn()} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Full name'), 'Driver')
    await user.type(screen.getByLabelText('Email address'), 'driver@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1')
    await user.selectOptions(screen.getByLabelText('Vehicle type'), 'EV')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByRole('button', { name: 'Creating account…' })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolve(Response.json({ userId: 'driver-1', email: 'driver@example.com', name: 'Driver' }, { status: 201 }))
    expect(await screen.findByRole('status')).toHaveTextContent('Account created')
  })

  it('renders a registration backend error as text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'CONFLICT', message: '<img src=x onerror=alert(1)> Email is already registered' } }, { status: 409 })))
    renderPage(<SignUpPage onSwitchMode={vi.fn()} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Full name'), 'Driver')
    await user.type(screen.getByLabelText('Email address'), 'driver@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1')
    await user.selectOptions(screen.getByLabelText('Vehicle type'), 'EV')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email is already registered')
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })
})
