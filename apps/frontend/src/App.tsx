import { useState } from 'react'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import SearchPage, { type InitialDestination } from './features/search/SearchPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { ProfilePage } from './pages/ProfilePage'
import { FavouritesPage } from './pages/FavouritesPage'
import { NavigationPage } from './pages/NavigationPage'
import { CarparkDetailPage } from './pages/CarparkDetailPage'
import type { CarparkDetails } from '@smart-parking/shared-types'
import './App.css'

type Page = 'sign-in' | 'sign-up' | 'search' | 'profile' | 'favourites' | 'navigation' | 'carpark-detail'

function AppShell() {
  const { session, logout } = useAuth()
  const [page, setPage] = useState<Page>('sign-in')
  const [handoff, setHandoff] = useState('')
  const [selectedCarParkNo, setSelectedCarParkNo] = useState<string | null>(null)
  const [selectedCarparkDetails, setSelectedCarparkDetails] = useState<CarparkDetails | undefined>(undefined)
  const [selectedDestination] = useState<InitialDestination | null>(null)
  const [returnPage, setReturnPage] = useState<Page>('search')

  const activePage: Page = session
    ? page === 'search' || page === 'favourites' || page === 'navigation' || page === 'carpark-detail'
      ? page
      : 'profile'
    : page === 'sign-up'
      ? 'sign-up'
      : 'sign-in'

  function navigate(next: Page) {
    setHandoff('')
    setPage(next)
  }

  function openCarparkDetail(carParkNo: string, details?: CarparkDetails) {
    setSelectedCarParkNo(carParkNo)
    setSelectedCarparkDetails(details)
    setPage('carpark-detail')
  }

  const content = (() => {
    switch (activePage) {
      case 'sign-in':
        return (
          <SignInPage
            onSignedIn={() => navigate('navigation')}
            onSwitchMode={() => navigate('sign-up')}
          />
        )

      case 'sign-up':
        return <SignUpPage onSwitchMode={() => navigate('sign-in')} />

      case 'search':
      case 'carpark-detail':
        return (
          <>
            <div style={activePage === 'carpark-detail' ? { display: 'none' } : undefined}>
              <SearchPage
                onSelectCarpark={(carParkNo) => {
                  setReturnPage('search')
                  openCarparkDetail(carParkNo)
                }}
                initialDestination={selectedDestination}
              />
            </div>
            {activePage === 'carpark-detail' && selectedCarParkNo && (
              <CarparkDetailPage
                carParkNo={selectedCarParkNo}
                initialDetails={selectedCarparkDetails}
                onBack={() => navigate(returnPage)}
                onNavigate={(details) => {
                  if (details) {
                    setSelectedCarParkNo(details.carpark.carParkNo)
                    setSelectedCarparkDetails(details)
                  }
                  navigate('navigation')
                }}
              />
            )}
          </>
        )

      case 'profile':
        return (
          <ProfilePage
            onAccountDeleted={() => navigate('sign-in')}
            onNavigate={navigate}
            onLogout={logout}
          />
        )

      case 'favourites':
        return (
          <FavouritesPage
            onSelect={(favourite) => {
              setReturnPage('favourites')
              const initial: CarparkDetails = {
                carpark: {
                  carParkNo: favourite.address || favourite.locationName,
                  address: favourite.address,
                  latitude: favourite.latitude,
                  longitude: favourite.longitude,
                  carParkType: 'Multi-storey',
                  isSheltered: true,
                  totalLots: 120,
                  freeParking: null,
                  nightParking: 'YES',
                  hasEvCharging: false,
                  parkingSystem: 'Electronic',
                  postalCode: null,
                  parkingCost: 0.6,
                  updatedAt: favourite.createdAt || new Date().toISOString(),
                },
                availability: {
                  availableLots: 48,
                  totalLots: 120,
                  status: 'Moderate',
                  lastUpdated: new Date().toISOString(),
                  isStale: false,
                },
              }
              openCarparkDetail(favourite.address || favourite.locationName, initial)
            }}
            onSearch={() => navigate('search')}
            onNavigate={navigate}
            onLogout={logout}
          />
        )

      case 'navigation':
        return (
          <NavigationPage
            onBack={() => navigate(returnPage === 'favourites' ? 'favourites' : 'search')}
            initialCarparkNo={selectedCarParkNo}
            initialCarparkDetails={selectedCarparkDetails}
            onNavigate={navigate}
            onLogout={logout}
          />
        )
    }
  })()

  return (
    <div className="app-shell">
      {session && (
        <nav className="app-navigation" aria-label="Account navigation">
          <button
            type="button"
            aria-current={activePage === 'profile' ? 'page' : undefined}
            onClick={() => navigate('profile')}
          >
            Profile
          </button>

          <button
            type="button"
            aria-current={activePage === 'favourites' ? 'page' : undefined}
            onClick={() => navigate('favourites')}
          >
            Favourites
          </button>

          <button
            type="button"
            aria-current={activePage === 'navigation' ? 'page' : undefined}
            onClick={() => navigate('navigation')}
          >
            Navigation
          </button>

          <button
            type="button"
            onClick={() => {
              logout()
              navigate('sign-in')
            }}
          >
            Log out
          </button>
        </nav>
      )}

      {session && handoff && (
        <p className="app-handoff" role="status">
          {handoff}
        </p>
      )}

      {content}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
