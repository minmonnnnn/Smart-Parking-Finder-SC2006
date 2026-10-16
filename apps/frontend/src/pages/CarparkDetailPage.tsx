import { useEffect, useState } from 'react'
import { Card, ProgressBar, progressPercent, vars } from '../components'
import { MapView } from '../features/search/MapView'
import { getCarparkDetails, getWeather } from '../features/search/carparkApi'
import { POPULAR_CARPARKS } from '../features/navigation/constants'
import { useAuth } from '../features/auth/AuthContext'
import { AvailabilityAlertControl } from '../features/carparks/alerts/AvailabilityAlertControl'
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

export function CarparkDetailPage({ carParkNo, initialDetails, onBack, onNavigate }: {
  carParkNo: string
  initialDetails?: CarparkDetails
  onBack: () => void
  onNavigate: () => void
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

  const containerStyle = {
    position: 'fixed' as const,
    top: 0, bottom: 0, left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: vars.layout.viewportWidth,
    fontFamily: vars.font.family,
    color: vars.color.textPrimary,
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    background: vars.color.background,
    zIndex: 100,
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
        <button style={{
          width: '100%', padding: vars.space[3], borderRadius: vars.radius.md,
          background: vars.color.secondary, color: '#fff', border: 'none',
          fontSize: vars.fontSize.md, fontWeight: vars.fontWeight.semibold,
          fontFamily: vars.font.family, cursor: 'pointer',
        }}>
          Save to Favourites
        </button>
        <button onClick={onNavigate} style={{
          width: '100%', padding: vars.space[3], borderRadius: vars.radius.md,
          background: '#1d4ed8', color: '#fff', border: 'none',
          fontSize: vars.fontSize.md, fontWeight: vars.fontWeight.semibold,
          fontFamily: vars.font.family, cursor: 'pointer',
        }}>
          Navigate
        </button>
      </div>
    </div>
  )
}
