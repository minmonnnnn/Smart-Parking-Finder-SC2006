import { useState } from 'react'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import SearchPage from './features/search/SearchPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { ProfilePage } from './pages/ProfilePage'
import { FavouritesPage } from './pages/FavouritesPage'
import { NavigationPage } from './pages/NavigationPage'
import { CarparkDetailPage } from './pages/CarparkDetailPage'
import './App.css'

type Page = 'sign-in' | 'sign-up' | 'search' | 'profile' | 'favourites' | 'navigation' | 'carpark-detail'

function AppShell() {
  const { session, logout } = useAuth()
  const [page, setPage] = useState<Page>('sign-in')
  const [handoff, setHandoff] = useState('')
  const [selectedCarParkNo, setSelectedCarParkNo] = useState<string | null>(null)

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

  function openCarparkDetail(carParkNo: string) {
    setSelectedCarParkNo(carParkNo)
    setPage('carpark-detail')
  }

  const content = (() => {
    switch (activePage) {
      case 'sign-in':
        return (
          <SignInPage
            onSignedIn={() => navigate('profile')}
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
              <SearchPage onSelectCarpark={openCarparkDetail} />
            </div>
            {activePage === 'carpark-detail' && selectedCarParkNo && (
              <CarparkDetailPage
                carParkNo={selectedCarParkNo}
                onBack={() => navigate('search')}
                onNavigate={() => navigate('navigation')}
              />
            )}
          </>
        )

      case 'profile':
        return <ProfilePage onAccountDeleted={() => navigate('sign-in')} />

      case 'favourites':
        return (
          <FavouritesPage
            onSelect={(favourite) =>
              setHandoff(
                `Selected ${favourite.locationName} (${favourite.address}).`,
              )
            }
            onSearch={() => navigate('search')}
          />
        )

      case 'navigation':
        return <NavigationPage onBack={() => navigate('search')} />
    }
  })()

  return (
    <div className="app-shell">
      {session && (
        <nav className="app-navigation" aria-label="Account navigation">
          <button
            type="button"
            aria-current={activePage === 'search' ? 'page' : undefined}
            onClick={() => navigate('search')}
          >
            Search
          </button>

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