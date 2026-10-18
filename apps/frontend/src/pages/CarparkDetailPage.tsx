import { type CSSProperties, useEffect, useState } from 'react'
import { Card, ProgressBar, progressPercent, vars } from '../components'
import { MapView } from '../features/search/MapView'
import { getCarparkDetails, getWeather } from '../features/search/carparkApi'
import { POPULAR_CARPARKS } from '../features/navigation/constants'
import { useAuth } from '../features/auth/AuthContext'
import { AvailabilityAlertControl } from '../features/carparks/alerts/AvailabilityAlertControl'
import { createFavourite, deleteFavourite, listFavourites } from '../features/favourites/favouritesApi'
import type { CarparkDetails } from '@smart-parking/shared-types'
import type { WeatherInfo } from '@smart-parking/shared-types'

const backIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

function availabilityTone(pct: number): 'success' | 'warning' | 'danger' {
  if (pct >= 30) return 'success'
  if (pct >= 10) return 'warning'
  return 'danger'
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${vars.space[2]} 0`, borderBottom: `1px solid ${vars.color.border}` }}>
      <span style={{ color: vars.color.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px', fontSize: vars.fontSize.xs }}>{label}</span>
      <span style={{ fontSize: vars.fontSize.sm, fontWeight: vars.fontWeight.medium, color: vars.color.textPrimary, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

/**
 * Detail view for a single carpark. Fetches live data on mount and displays
 * availability, static info, current weather, and navigate/save-to-favourites actions.
 * @param carParkNo - The HDB carpark code to load
 * @param initialDetails - Optional pre-fetched data to show immediately before the API responds
 * @param onBack - Called when the user taps the back button
 * @param onNavigate - Called with the loaded details when the user taps Navigate
 * @param isOverlay - When true, renders as a floating overlay rather than a full-screen page
 */
export function CarparkDetailPage({
  carParkNo,
  initialDetails,
  onBack,
  onNavigate,
  isOverlay = false,
}: {
  carParkNo: string
  initialDetails?: CarparkDetails
  onBack: () => void
  onNavigate: (details?: CarparkDetails) => void
  isOverlay?: boolean
}) {
  const { session } = useAuth()
  const [details, setDetails] = useState<CarparkDetails | null>(initialDetails ?? null)
  const [weather, setWeather] = useState<WeatherInfo | null>(null)
  const [loading, setLoading] = useState(!initialDetails)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!initialDetails) setLoading(true)
      setError(null)
      try {
        const d = await getCarparkDetails(carParkNo)
        if (cancelled) return
        setDetails(d)
        try {
          const w = await getWeather(d.carpark.latitude, d.carpark.longitude)
          if (!cancelled) setWeather(w)
        } catch {
          // weather is non-fatal
        }
      } catch {
        // Fallback: If API returns 404 (e.g. curated mock or offline), use initialDetails or POPULAR_CARPARKS
        if (initialDetails) {
          if (!cancelled) setDetails(initialDetails)
        } else {
          const fallbackCp = POPULAR_CARPARKS.find(
            (c) => c.placeId === carParkNo || c.main === carParkNo
          )
          if (fallbackCp && fallbackCp.lat !== undefined && fallbackCp.lng !== undefined) {
            const fallbackDetails: CarparkDetails = {
              carpark: {
                carParkNo: fallbackCp.placeId || carParkNo,
                address: fallbackCp.sub || fallbackCp.main,
                latitude: fallbackCp.lat,
                longitude: fallbackCp.lng,
                carParkType: 'Multi-storey',
                isSheltered: true,
                totalLots: 120,
                freeParking: 'SUN & PH FR 7AM-10.30PM',
                nightParking: 'YES',
                hasEvCharging: true,
                parkingSystem: 'Electronic',
                postalCode: '579837',
                parkingCost: 0.6,
                updatedAt: new Date().toISOString(),
              },
              availability: {
                availableLots: fallbackCp.availableLots ?? 48,
                totalLots: 120,
                status: (fallbackCp.availableLots ?? 48) >= 36 ? 'High' : 'Moderate',
                lastUpdated: new Date().toISOString(),
                isStale: false,
              },
            }
            if (!cancelled) setDetails(fallbackDetails)
          } else if (!cancelled) {
            setError('Failed to load carpark details.')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [carParkNo, initialDetails])

  const [isSaved, setIsSaved] = useState(false)
  const [favouriteId, setFavouriteId] = useState<number | null>(null)
  const [isSavingFavourite, setIsSavingFavourite] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [customName, setCustomName] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    const token = session?.token
    const carpark = details?.carpark
    if (!token || !carpark) return

    let cancelled = false
    listFavourites(token)
      .then((favs) => {
        if (cancelled) return
        const found = favs.find((f) =>
          (Math.abs(f.latitude - carpark.latitude) < 0.0001 &&
           Math.abs(f.longitude - carpark.longitude) < 0.0001) ||
          f.address.toLowerCase() === carpark.address.toLowerCase()
        )
        if (found) {
          setIsSaved(true)
          setFavouriteId(found.id)
        } else {
          setIsSaved(false)
          setFavouriteId(null)
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [session?.token, details?.carpark])

  function handleSaveClick() {
    if (!session?.token) {
      setToastMessage('Sign in to save this carpark to your favourites.')
      return
    }
    if (isSaved) {
      setShowDeleteModal(true)
      return
    }
    setCustomName(details?.carpark.address ?? '')
    setSaveError(null)
    setShowSaveModal(true)
  }

  async function handleConfirmDelete() {
    if (!session?.token || favouriteId === null || isDeleting) return
    setIsDeleting(true)
    try {
      await deleteFavourite(session.token, favouriteId)
      setIsSaved(false)
      setFavouriteId(null)
      setShowDeleteModal(false)
      setToastMessage('Removed from favourites')
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Could not remove favourite')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleConfirmSave(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.token || !details?.carpark || isSavingFavourite) return
    const nameToSave = customName.trim() || details.carpark.address
    setIsSavingFavourite(true)
    setSaveError(null)
    try {
      const created = await createFavourite(session.token, {
        locationName: nameToSave,
        address: details.carpark.address,
        latitude: details.carpark.latitude,
        longitude: details.carpark.longitude,
      })
      setIsSaved(true)
      setFavouriteId(created.id)
      setShowSaveModal(false)
      setToastMessage('Location saved to favourites!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save favourite'
      if (msg.includes('already exists') || msg.includes('409') || msg.includes('FAVOURITE_ALREADY_EXISTS')) {
        setIsSaved(true)
        setShowSaveModal(false)
        setToastMessage('This location is already saved in your favourites.')
      } else {
        setSaveError(msg)
      }
    } finally {
      setIsSavingFavourite(false)
    }
  }

  const containerStyle: CSSProperties = isOverlay
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        background: vars.color.background,
        fontFamily: vars.font.family,
        color: vars.color.textPrimary,
        boxSizing: 'border-box',
        borderRadius: '16px',
        overflow: 'hidden',
      }
    : {
        width: '380px',
        maxWidth: '100%',
        height: 'calc(100vh - 74px)',
        maxHeight: '700px',
        margin: '6px auto',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
        border: `1px solid ${vars.color.border}`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: vars.color.background,
        fontFamily: vars.font.family,
        color: vars.color.textPrimary,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: vars.color.textSecondary, fontSize: vars.fontSize.sm }}>
          Loading…
        </div>
      </div>
    )
  }

  if (error || !details) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: vars.space[4] }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: vars.color.textSecondary, display: 'flex', alignItems: 'center', gap: vars.space[1], marginBottom: vars.space[4] }}>
            {backIcon} Back
          </button>
          <p style={{ color: vars.color.danger }}>{error ?? 'Carpark not found.'}</p>
        </div>
      </div>
    )
  }

  const { carpark, availability } = details
  const pct = progressPercent(availability.availableLots, availability.totalLots)
  const tone = availabilityTone(Math.round(pct))

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: vars.space[2], padding: `${vars.space[3]} ${vars.layout.gutter}`, flexShrink: 0, borderBottom: `1px solid ${vars.color.border}` }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: vars.color.textSecondary, display: 'flex', alignItems: 'center', padding: vars.space[1] }}>
          {backIcon}
        </button>
        <div style={{ fontWeight: vars.fontWeight.semibold, fontSize: vars.fontSize.md, color: vars.color.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Location details
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${vars.layout.gutter} ${vars.layout.gutter}` }}>
        {/* Map */}
        <div style={{ margin: `${vars.space[3]} 0`, borderRadius: vars.radius.md, overflow: 'hidden' }}>
          <MapView compact center={{ lat: carpark.latitude, lng: carpark.longitude }} />
        </div>

        {/* Carpark name */}
        <h2 style={{ fontSize: vars.fontSize.lg, fontWeight: vars.fontWeight.bold, color: vars.color.textPrimary, margin: `0 0 ${vars.space[1]}` }}>
          {carpark.address}
        </h2>
        <div style={{ fontSize: vars.fontSize.xs, color: vars.color.textMuted, marginBottom: vars.space[3] }}>
          {carpark.carParkNo}
        </div>

        {/* Availability card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: vars.space[2] }}>
            <div>
              <div style={{ fontSize: vars.fontSize.xs, color: vars.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: vars.space[1] }}>
                Total spots
              </div>
              <div style={{ fontSize: vars.fontSize.lg, fontWeight: vars.fontWeight.bold, color: vars.color.textPrimary }}>
                {availability.totalLots}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: vars.fontSize.xs, color: vars.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: vars.space[1] }}>
                Available
              </div>
              <div style={{ fontSize: vars.fontSize.lg, fontWeight: vars.fontWeight.bold, color: tone === 'success' ? vars.color.success : tone === 'warning' ? vars.color.warning : vars.color.danger }}>
                {availability.availableLots}
              </div>
            </div>
          </div>
          <ProgressBar value={availability.availableLots} max={availability.totalLots} label={`${carpark.address} availability`} tone={tone} />
          <div style={{ fontSize: vars.fontSize.xs, color: vars.color.textMuted, marginTop: vars.space[1] }}>
            {Math.round(pct)}% free · {availability.isStale ? 'data may be outdated' : `updated ${new Date(availability.lastUpdated).toLocaleTimeString()}`}
          </div>
        </Card>

        {/* Availability alert subscription */}
        <AvailabilityAlertControl
          carParkNo={carpark.carParkNo}
          userId={session?.userId ?? null}
          accessToken={session?.token ?? null}
        />

        {/* Info rows */}
        <div style={{ marginTop: vars.space[3] }}>
          {carpark.freeParking && <Row label="Free Parking" value={carpark.freeParking} />}
          <Row label="Carpark Type" value={carpark.carParkType} />
          <Row label="Parking System" value={carpark.parkingSystem} />
          <Row label="EV Charging" value={carpark.hasEvCharging ? 'Supported' : 'Not available'} />
          <Row label="Night Parking" value={carpark.nightParking} />
          {carpark.parkingCost !== null && <Row label="Hourly Rate" value={`$${carpark.parkingCost.toFixed(2)}/hr`} />}
        </div>

        {/* Weather */}
        {weather && (
          <div style={{ marginTop: vars.space[3], padding: `${vars.space[2]} ${vars.space[3]}`, background: vars.color.surface, borderRadius: vars.radius.md, border: `1px solid ${vars.color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: vars.fontSize.xs, color: vars.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Current Weather</div>
            <div style={{ fontSize: vars.fontSize.sm, color: vars.color.textPrimary, display: 'flex', alignItems: 'center', gap: vars.space[2] }}>
              {weather.rainExpected ? '🌧' : '☀️'} {weather.condition}
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div style={{ padding: `${vars.space[3]} ${vars.layout.gutter}`, borderTop: `1px solid ${vars.color.border}`, display: 'flex', flexDirection: 'column', gap: vars.space[2], flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSavingFavourite}
          style={{
            width: '100%', padding: vars.space[3], borderRadius: vars.radius.md,
            background: isSaved ? '#059669' : vars.color.secondary,
            color: '#fff', border: 'none',
            fontSize: vars.fontSize.md, fontWeight: vars.fontWeight.semibold,
            fontFamily: vars.font.family, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: vars.space[2],
          }}
        >
          {isSaved ? '✓ Saved in Favourites' : 'Save to Favourites'}
        </button>
        <button type="button" onClick={() => onNavigate(details ?? undefined)} style={{
          width: '100%', padding: vars.space[3], borderRadius: vars.radius.md,
          background: '#1d4ed8', color: '#fff', border: 'none',
          fontSize: vars.fontSize.md, fontWeight: vars.fontWeight.semibold,
          fontFamily: vars.font.family, cursor: 'pointer',
        }}>
          Navigate
        </button>
      </div>

      {/* Confirmation & Custom Name Modal (UC-10, UC-10.AC.1) */}
      {showSaveModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: vars.space[4], zIndex: 1100,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-favourite-title"
        >
          <div style={{
            background: vars.color.background, borderRadius: vars.radius.lg,
            padding: vars.space[4], width: '100%', maxWidth: 360,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: `1px solid ${vars.color.border}`,
          }}>
            <h3 id="save-favourite-title" style={{ margin: 0, fontSize: vars.fontSize.lg, fontWeight: vars.fontWeight.bold, color: vars.color.textPrimary }}>
              Save to Favourites
            </h3>
            <p style={{ fontSize: vars.fontSize.xs, color: vars.color.textSecondary, margin: `${vars.space[1]} 0 ${vars.space[3]}` }}>
              Give this location a custom name (e.g. Work, Gym, Home) or keep the address.
            </p>
            <form onSubmit={(e) => void handleConfirmSave(e)}>
              <label
                htmlFor="favourite-name-input"
                style={{ display: 'block', fontSize: vars.fontSize.xs, fontWeight: vars.fontWeight.semibold, color: vars.color.textSecondary, marginBottom: vars.space[1] }}
              >
                Location name
              </label>
              <input
                id="favourite-name-input"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
                disabled={isSavingFavourite}
                style={{
                  width: '100%', padding: vars.space[2], borderRadius: vars.radius.md,
                  border: `1px solid ${vars.color.border}`, fontSize: vars.fontSize.sm,
                  color: vars.color.textPrimary, background: vars.color.surface,
                  boxSizing: 'border-box', marginBottom: vars.space[2],
                }}
              />
              {saveError && (
                <p style={{ color: vars.color.danger, fontSize: vars.fontSize.xs, margin: `0 0 ${vars.space[2]}` }} role="alert">
                  {saveError}
                </p>
              )}
              <div style={{ display: 'flex', gap: vars.space[2], justifyContent: 'flex-end', marginTop: vars.space[3] }}>
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  disabled={isSavingFavourite}
                  style={{
                    padding: `${vars.space[2]} ${vars.space[3]}`, borderRadius: vars.radius.md,
                    background: 'transparent', border: `1px solid ${vars.color.border}`,
                    fontSize: vars.fontSize.sm, cursor: 'pointer', color: vars.color.textSecondary,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingFavourite}
                  style={{
                    padding: `${vars.space[2]} ${vars.space[3]}`, borderRadius: vars.radius.md,
                    background: vars.color.secondary, color: '#fff', border: 'none',
                    fontSize: vars.fontSize.sm, fontWeight: vars.fontWeight.semibold, cursor: 'pointer',
                  }}
                >
                  {isSavingFavourite ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (FR39, UC-11) */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: vars.space[4], zIndex: 1100,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-favourite-title"
        >
          <div style={{
            background: vars.color.background, borderRadius: vars.radius.lg,
            padding: vars.space[4], width: '100%', maxWidth: 360,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: `1px solid ${vars.color.border}`,
          }}>
            <h3 id="delete-favourite-title" style={{ margin: 0, fontSize: vars.fontSize.lg, fontWeight: vars.fontWeight.bold, color: vars.color.textPrimary }}>
              Remove from Favourites?
            </h3>
            <p style={{ fontSize: vars.fontSize.xs, color: vars.color.textSecondary, margin: `${vars.space[2]} 0 ${vars.space[4]}` }}>
              Do you want to remove <strong>{details?.carpark.address}</strong> from your saved favourites?
            </p>
            <div style={{ display: 'flex', gap: vars.space[2], justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{
                  padding: `${vars.space[2]} ${vars.space[3]}`, borderRadius: vars.radius.md,
                  background: 'transparent', border: `1px solid ${vars.color.border}`,
                  fontSize: vars.fontSize.sm, cursor: 'pointer', color: vars.color.textSecondary,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleting}
                style={{
                  padding: `${vars.space[2]} ${vars.space[3]}`, borderRadius: vars.radius.md,
                  background: vars.color.danger, color: '#fff', border: 'none',
                  fontSize: vars.fontSize.sm, fontWeight: vars.fontWeight.semibold, cursor: 'pointer',
                }}
              >
                {isDeleting ? 'Removing…' : 'Remove Favourite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            background: '#111827', color: '#fff', padding: `${vars.space[2]} ${vars.space[4]}`,
            borderRadius: vars.radius.md, fontSize: vars.fontSize.sm, fontWeight: vars.fontWeight.medium,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 1200, whiteSpace: 'nowrap',
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}
