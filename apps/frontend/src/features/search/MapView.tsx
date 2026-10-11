import React from 'react'
import { GoogleMap, useLoadScript } from '@react-google-maps/api'

const SINGAPORE_CENTER = { lat: 1.3521, lng: 103.8198 }

interface MapViewProps {
  center?: google.maps.LatLngLiteral
  zoom?: number
  compact?: boolean
}

function MapFallback({ compact, error }: { compact: boolean; error?: boolean }) {
  const style: React.CSSProperties = compact
    ? { width: '100%', height: 160 }
    : { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }
  return (
    <div style={{
      ...style,
      background: error ? '#fee2e2' : '#e8f0e8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      color: error ? '#dc2626' : '#6b8f6b',
    }}>
      {error ? 'Map failed to load' : 'Loading map…'}
    </div>
  )
}

export function MapView({ center = SINGAPORE_CENTER, zoom = 13, compact = false }: MapViewProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  })

  if (loadError) return <MapFallback compact={compact} error />
  if (!isLoaded) return <MapFallback compact={compact} />


  return (
    <GoogleMap
      mapContainerStyle={
        compact
          ? { width: '100%', height: 160 }
          : { position: 'absolute', inset: '0' }
      }
      center={center}
      zoom={zoom}
      options={{
        disableDefaultUI: true,
        gestureHandling: compact ? 'none' : 'greedy',
        clickableIcons: false,
      }}
    />
  )
}
