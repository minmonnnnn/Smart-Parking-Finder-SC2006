import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NavigationPage } from './NavigationPage'

vi.mock('../features/navigation/components/NavigationMap', () => ({
  NavigationMap: () => <div data-testid="mock-navigation-map" />,
}))

vi.mock('../features/navigation/components/NavigationBottomSheet', () => ({
  NavigationBottomSheet: (props: { carpark?: { name: string }; destination?: { name?: string; main?: string } }) => (
    <div
      data-testid="mock-bottom-sheet"
      data-carpark={props.carpark?.name}
      data-destination={props.destination?.main || props.destination?.name}
    />
  ),
}))

vi.mock('../features/navigation/hooks/useNavigationRoutes', () => ({
  useNavigationRoutes: () => ({
    drivingRoutes: [],
    activeRouteIndex: 0,
    setActiveRouteIndex: vi.fn(),
    activeDrivingRoute: null,
    walkingInfo: null,
    isCalculatingRoute: false,
  }),
}))

vi.mock('../features/navigation/hooks/weather', () => ({
  useWeather: () => ({
    weather: null,
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('NavigationPage side navigation and header', () => {
  it('renders top header bar with hamburger menu button above the map', () => {
    render(<NavigationPage />)

    const menuButton = screen.getByRole('button', { name: 'Navigation menu' })
    expect(menuButton).toBeInTheDocument()
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')

    const mapElement = screen.getByTestId('mock-navigation-map')
    expect(mapElement).toBeInTheDocument()

    // Side nav is initially closed
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument()
  })

  it('opens side navigation drawer when hamburger button is clicked', async () => {
    const user = userEvent.setup()
    render(<NavigationPage />)

    const menuButton = screen.getByRole('button', { name: 'Navigation menu' })
    await user.click(menuButton)

    // Side nav drawer should be visible
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    const dialog = screen.getByRole('dialog', { name: 'Side navigation' })
    expect(dialog).toBeInTheDocument()

    // Contains Favourites option
    const favouritesBtn = screen.getByRole('button', { name: 'Favourites' })
    expect(favouritesBtn).toBeInTheDocument()
  })

  it('navigates to favourites and closes drawer when Favourites is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<NavigationPage onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: 'Navigation menu' }))
    const favouritesBtn = screen.getByRole('button', { name: 'Favourites' })
    await user.click(favouritesBtn)

    expect(onNavigate).toHaveBeenCalledWith('favourites')
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument()
  })

  it('closes side navigation drawer when clicking the backdrop overlay', async () => {
    const user = userEvent.setup()
    render(<NavigationPage />)

    await user.click(screen.getByRole('button', { name: 'Navigation menu' }))
    const dialog = screen.getByRole('dialog', { name: 'Side navigation' })
    expect(dialog).toBeInTheDocument()

    // Click the backdrop overlay
    await user.click(dialog)
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument()
  })

  it('toggles side navigation drawer closed when clicking the hamburger button again', async () => {
    const user = userEvent.setup()
    render(<NavigationPage />)

    const menuButton = screen.getByRole('button', { name: 'Navigation menu' })
    await user.click(menuButton)
    expect(screen.getByRole('dialog', { name: 'Side navigation' })).toBeInTheDocument()

    await user.click(menuButton)
    expect(screen.queryByRole('dialog', { name: 'Side navigation' })).not.toBeInTheDocument()
  })

  it('initializes direct carpark routing when initialCarparkDetails is provided', () => {
    const mockDetails = {
      carpark: {
        carParkNo: 'SH2',
        address: 'BLK 320 SHUNFU ROAD',
        latitude: 1.352,
        longitude: 103.836,
        carParkType: 'Multi-storey' as const,
        isSheltered: true,
        totalLots: 120,
        freeParking: null,
        nightParking: 'YES',
        hasEvCharging: false,
        parkingSystem: 'Electronic' as const,
        postalCode: '579837',
        parkingCost: 0.6,
        updatedAt: new Date().toISOString(),
      },
      availability: {
        availableLots: 55,
        totalLots: 120,
        status: 'High' as const,
        lastUpdated: new Date().toISOString(),
        isStale: false,
      },
    }

    render(<NavigationPage initialCarparkDetails={mockDetails} />)

    const bottomSheet = screen.getByTestId('mock-bottom-sheet')
    expect(bottomSheet).toHaveAttribute('data-carpark', 'BLK 320 SHUNFU ROAD')
    expect(bottomSheet).toHaveAttribute('data-destination', 'BLK 320 SHUNFU ROAD')
  })
})

