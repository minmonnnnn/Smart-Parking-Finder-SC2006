import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../features/auth/AuthContext'
import { AUTH_STORAGE_KEY } from '../features/auth/authStorage'
import { CarparkDetailPage } from './CarparkDetailPage'
import { createFavourite, deleteFavourite, listFavourites } from '../features/favourites/favouritesApi'
import type { CarparkDetails, FavouriteLocation } from '@smart-parking/shared-types'

vi.mock('../features/favourites/favouritesApi', () => ({
  listFavourites: vi.fn(),
  createFavourite: vi.fn(),
  deleteFavourite: vi.fn(),
}))

vi.mock('../features/search/MapView', () => ({
  MapView: () => <div data-testid="mock-map-view" />,
}))

vi.mock('../features/carparks/alerts/AvailabilityAlertControl', () => ({
  AvailabilityAlertControl: () => <div data-testid="mock-alert-control" />,
}))

const sampleDetails: CarparkDetails = {
  carpark: {
    carParkNo: 'TP21',
    address: 'BLK 261-264 TOA PAYOH EAST',
    latitude: 1.332,
    longitude: 103.856,
    carParkType: 'Multi-storey',
    isSheltered: true,
    totalLots: 120,
    freeParking: 'SUN & PH FR 7AM-10.30PM',
    nightParking: 'YES',
    hasEvCharging: true,
    parkingSystem: 'Electronic',
    postalCode: '310261',
    parkingCost: 0.6,
    updatedAt: '2026-10-16T00:00:00.000Z',
  },
  availability: {
    availableLots: 48,
    totalLots: 120,
    status: 'High',
    lastUpdated: '2026-10-16T00:00:00.000Z',
    isStale: false,
  },
}

const mockFavourite: FavouriteLocation = {
  id: 101,
  userId: 'user-1',
  locationName: 'My Work',
  address: 'BLK 261-264 TOA PAYOH EAST',
  latitude: 1.332,
  longitude: 103.856,
  createdAt: '2026-10-16T00:00:00.000Z',
}

describe('CarparkDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(listFavourites).mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  function renderPage(props: {
    carParkNo?: string
    initialDetails?: CarparkDetails
    onBack?: () => void
    onNavigate?: () => void
    authenticated?: boolean
  } = {}) {
    if (props.authenticated) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: 'user-1', token: 'session-token' }))
    }
    const onBack = props.onBack ?? vi.fn()
    const onNavigate = props.onNavigate ?? vi.fn()
    const result = render(
      <AuthProvider>
        <CarparkDetailPage
          carParkNo={props.carParkNo ?? 'TP21'}
          initialDetails={props.initialDetails ?? sampleDetails}
          onBack={onBack}
          onNavigate={onNavigate}
        />
      </AuthProvider>
    )
    return { ...result, onBack, onNavigate }
  }

  it('renders carpark details, lots, and triggers navigation callbacks', async () => {
    const user = userEvent.setup()
    const { onBack, onNavigate } = renderPage({ authenticated: false })

    expect(screen.getByText('BLK 261-264 TOA PAYOH EAST')).toBeInTheDocument()
    expect(screen.getByText('TP21')).toBeInTheDocument()
    expect(screen.getByText('48')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('$0.60/hr')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Navigate' }))
    expect(onNavigate).toHaveBeenCalledOnce()
  })

  it('prompts user to sign in when clicking save while unauthenticated', async () => {
    const user = userEvent.setup()
    renderPage({ authenticated: false })

    await user.click(screen.getByRole('button', { name: 'Save to Favourites' }))
    expect(await screen.findByText('Sign in to save this carpark to your favourites.')).toBeInTheDocument()
    expect(createFavourite).not.toHaveBeenCalled()
  })

  it('detects existing favourite on load and allows removing it', async () => {
    vi.mocked(listFavourites).mockResolvedValue([mockFavourite])
    vi.mocked(deleteFavourite).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage({ authenticated: true })

    expect(await screen.findByRole('button', { name: '✓ Saved in Favourites' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '✓ Saved in Favourites' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Remove from Favourites\?/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove Favourite' }))
    expect(deleteFavourite).toHaveBeenCalledWith('session-token', mockFavourite.id)
    expect(await screen.findByText('Removed from favourites')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save to Favourites' })).toBeInTheDocument()
  })

  it('allows authenticated user to save with a custom name', async () => {
    vi.mocked(listFavourites).mockResolvedValue([])
    vi.mocked(createFavourite).mockResolvedValue({
      id: 102,
      userId: 'user-1',
      locationName: 'Work Gym',
      address: sampleDetails.carpark.address,
      latitude: sampleDetails.carpark.latitude,
      longitude: sampleDetails.carpark.longitude,
      createdAt: '2026-10-16T00:00:00.000Z',
    })

    const user = userEvent.setup()
    renderPage({ authenticated: true })

    const saveBtn = await screen.findByRole('button', { name: 'Save to Favourites' })
    await user.click(saveBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const nameInput = screen.getByRole('textbox', { name: 'Location name' })
    expect(nameInput).toHaveValue(sampleDetails.carpark.address)

    await user.clear(nameInput)
    await user.type(nameInput, 'Work Gym')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(createFavourite).toHaveBeenCalledWith('session-token', {
        locationName: 'Work Gym',
        address: sampleDetails.carpark.address,
        latitude: sampleDetails.carpark.latitude,
        longitude: sampleDetails.carpark.longitude,
      })
    })

    expect(await screen.findByText('Location saved to favourites!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '✓ Saved in Favourites' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('handles duplicate error gracefully (UC-10.AC.2)', async () => {
    vi.mocked(listFavourites).mockResolvedValue([])
    vi.mocked(createFavourite).mockRejectedValue(new Error('FAVOURITE_ALREADY_EXISTS: Favourite already exists'))

    const user = userEvent.setup()
    renderPage({ authenticated: true })

    await user.click(await screen.findByRole('button', { name: 'Save to Favourites' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('This location is already saved in your favourites.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '✓ Saved in Favourites' })).toBeInTheDocument()
  })

  it('cancels modal when Cancel button is clicked', async () => {
    vi.mocked(listFavourites).mockResolvedValue([])
    const user = userEvent.setup()
    renderPage({ authenticated: true })

    await user.click(await screen.findByRole('button', { name: 'Save to Favourites' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(createFavourite).not.toHaveBeenCalled()
  })
})

