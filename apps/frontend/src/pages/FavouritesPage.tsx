import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { FavouriteLocation } from '@smart-parking/shared-types'
import { useAuth } from '../features/auth/AuthContext'
import { loadSession } from '../features/auth/authStorage'
import { deleteFavourite, listFavourites, renameFavourite } from '../features/favourites/favouritesApi'
import { useFavouriteDeletion } from '../features/favourites/useFavouriteDeletion'
import { MobileHeader } from '../components/MobileHeader'
import '../features/favourites/favourites.css'

interface FavouritesPageProps {
  onSelect(favourite: FavouriteLocation): void
  onSearch(): void
  onNavigate?(page: 'search' | 'favourites' | 'profile' | 'navigation'): void
  onLogout?(): void
}

// Displays the authenticated user's saved locations and supports selection, renaming and deletion with undo
export function FavouritesPage({ onSelect, onSearch, onNavigate, onLogout }: FavouritesPageProps) {
  const { session, logout } = useAuth()

  if (session?.isGuest) {
    return (
      <>
        <MobileHeader
          title="Saved locations"
          onNavigate={onNavigate || ((p) => { if (p === 'search' || p === 'navigation') onSearch(); })}
          onLogout={onLogout || logout}
        />
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#FEE2E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#EF4444',
            fontSize: '28px',
          }}>
            ♥
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1E293B', margin: 0 }}>
            Sign In Required
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '320px', margin: 0, lineHeight: 1.5 }}>
            Favourites are saved to your personal account. Sign in or register to bookmark your frequent carparks.
          </p>
          <button
            type="button"
            onClick={onLogout || logout}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign In / Register
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <MobileHeader
        title="Saved locations"
        onNavigate={onNavigate || ((p) => { if (p === 'search' || p === 'navigation') onSearch(); })}
        onLogout={onLogout || logout}
      />
      <FavouritesSession
        key={session?.token ?? ''}
        token={session?.token}
        onSelect={onSelect}
        onSearch={onSearch}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
    </>
  )
}

function FavouritesSession({
  token,
  onSelect,
  onSearch,
}: FavouritesPageProps & { token: string | undefined }) {
  const [favourites, setFavourites] = useState<FavouriteLocation[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [renameError, setRenameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState<FavouriteLocation | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const confirmDeleteRef = useRef<HTMLButtonElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef(false)
  const requestGenerationRef = useRef(0)
  const deletion = useFavouriteDeletion(
    (id) => (token ? deleteFavourite(token, id) : Promise.reject(new Error('Sign in to manage saved locations'))),
    {
      shouldFlushOnUnmount: () => {
        const active = loadSession()
        return Boolean(token && active && active.token === token)
      },
    },
  )

  const load = useCallback(async () => {
    const generation = ++requestGenerationRef.current
    if (!token) {
      setLoading(false)
      setLoadError('Sign in to view saved locations.')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const result = await listFavourites(token)
      if (requestGenerationRef.current === generation) setFavourites(result)
    } catch {
      if (requestGenerationRef.current === generation) setLoadError('Could not load saved locations. Try again.')
    } finally {
      if (requestGenerationRef.current === generation) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) void load() })
    return () => { active = false; requestGenerationRef.current += 1 }
  }, [load])

  useEffect(() => {
    function handleBeforeUnload() {
      const active = loadSession()
      if (token && active && active.token === token) {
        deletion.flush()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [token, deletion])

  useEffect(() => {
    if (confirming) cancelDeleteRef.current?.focus()
    else if (restoreFocusRef.current) {
      restoreFocusRef.current = false
      deleteTriggerRef.current?.focus()
    }
  }, [confirming])

  useEffect(() => {
    if (deletion.pendingFavourite) undoRef.current?.focus()
  }, [deletion.pendingFavourite])

  function startRename(favourite: FavouriteLocation) {
    setEditingId(favourite.id)
    setName(favourite.locationName)
    setRenameError('')
  }

  function cancelRename() {
    if (saving) return
    setEditingId(null)
    setRenameError('')
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingId === null || saving || !token) return
    const trimmed = name.trim()
    if (!trimmed) {
      setRenameError('Enter a location name')
      return
    }
    setRenameError('')
    setSaving(true)
    try {
      const renamed = await renameFavourite(token, editingId, trimmed)
      setFavourites((items) => items?.map((item) => item.id === editingId ? renamed : item) ?? null)
      setEditingId(null)
    } catch (cause) {
      setRenameError(cause instanceof Error ? cause.message : 'Could not rename this location. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function closeConfirmation() {
    restoreFocusRef.current = true
    setConfirming(null)
  }

  function handleDialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeConfirmation()
    }
    if (event.key !== 'Tab') return
    if (event.shiftKey && document.activeElement === cancelDeleteRef.current) {
      event.preventDefault()
      confirmDeleteRef.current?.focus()
    } else if (!event.shiftKey && document.activeElement === confirmDeleteRef.current) {
      event.preventDefault()
      cancelDeleteRef.current?.focus()
    }
  }

  function confirmDeletion() {
    if (!confirming) return
    deletion.scheduleDelete(confirming)
    setConfirming(null)
  }

  function handleSelect(favourite: FavouriteLocation) {
    if (editingId !== favourite.id) {
      deletion.flush()
      onSelect(favourite)
    }
  }

  function handleSearch() {
    deletion.flush()
    onSearch()
  }

  const visible = favourites?.filter((favourite) => !deletion.isHidden(favourite.id))

  return <main className="favourites-screen">
    <section className="favourites-panel" aria-labelledby="favourites-title" inert={confirming !== null}>
      <header className="favourites-heading">
        <p className="favourites-eyebrow">SMART PARKING · YOUR PLACES</p>
        <h1 id="favourites-title">Saved locations.</h1>
        <p>Pick a familiar destination to find parking nearby.</p>
      </header>

      {loading && <p className="favourites-state" role="status">Loading saved locations…</p>}
      {!loading && loadError && <div className="favourites-state">
        <p role="alert">{loadError}</p>
        {token && <button type="button" className="favourites-secondary" onClick={() => void load()}>Try again</button>}
      </div>}
      {!loading && !loadError && visible?.length === 0 && <div className="favourites-empty">
        <h2>No saved locations yet</h2>
        <p>Search for a destination and save it here for next time.</p>
        <button type="button" className="favourites-primary" onClick={handleSearch}>Search destinations</button>
      </div>}
      {!loading && !loadError && visible && visible.length > 0 && <ul className="favourites-list">
        {visible.map((favourite) => (
          <li
            className="favourite-card"
            key={favourite.id}
            tabIndex={0}
            role="button"
            aria-label={`View details for ${favourite.locationName}`}
            onClick={() => handleSelect(favourite)}
            onKeyDown={(e) => {
              if (editingId !== favourite.id && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                handleSelect(favourite)
              }
            }}
          >
            <div className="favourite-pin" aria-hidden="true">⌖</div>
            <div className="favourite-main">
              {editingId === favourite.id ? (
                <form
                  className="favourite-rename"
                  onSubmit={(event) => void saveName(event)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <label htmlFor={`favourite-name-${favourite.id}`}>Location name</label>
                  <input
                    id={`favourite-name-${favourite.id}`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={!!renameError}
                    autoFocus
                  />
                  {renameError && <p className="favourites-error" role="alert">{renameError}</p>}
                  <div className="favourite-actions">
                    <button type="button" className="favourites-secondary" onClick={cancelRename} disabled={saving}>Cancel rename</button>
                    <button type="submit" className="favourites-primary" disabled={saving}>{saving ? 'Saving…' : 'Save name'}</button>
                  </div>
                </form>
              ) : (
                <>
                  <h2>{favourite.locationName}</h2>
                  <p className="favourite-address">{favourite.address}</p>
                  <div className="favourite-actions">
                    <button
                      type="button"
                      className="favourites-secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        startRename(favourite)
                      }}
                    >
                      Rename {favourite.locationName}
                    </button>
                    <button
                      type="button"
                      className="favourites-text-button"
                      disabled={deletion.deletionBusy}
                      onClick={(event) => {
                        event.stopPropagation()
                        deleteTriggerRef.current = event.currentTarget
                        setConfirming(favourite)
                      }}
                    >
                      Delete {favourite.locationName}
                    </button>
                  </div>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>}
      {deletion.error && <p className="favourites-error favourites-delete-error" role="alert">{deletion.error}</p>}
    </section>

    {deletion.pendingFavourite && <div className="favourites-toast" role="status">
      <span>{deletion.pendingFavourite.locationName} removed</span>
      <button ref={undoRef} type="button" onClick={deletion.undoDelete}>Undo</button>
    </div>}

    {confirming && <div className="favourites-modal-backdrop">
      <div className="favourites-modal" role="dialog" aria-modal="true" aria-labelledby="favourite-delete-title" aria-describedby="favourite-delete-description" onKeyDown={handleDialogKeys}>
        <h2 id="favourite-delete-title">Delete {confirming.locationName}?</h2>
        <p id="favourite-delete-description">This saved location will be removed. You can undo for 5 seconds.</p>
        <div className="favourite-actions">
          <button ref={cancelDeleteRef} type="button" className="favourites-secondary" onClick={closeConfirmation}>Cancel deletion</button>
          <button ref={confirmDeleteRef} type="button" className="favourites-primary" onClick={confirmDeletion}>Confirm deletion</button>
        </div>
      </div>
    </div>}
  </main>
}
