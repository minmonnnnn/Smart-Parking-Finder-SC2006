import type { Libraries } from '@react-google-maps/api'

export const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-script'
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places', 'geometry']

export function getGoogleMapsApiKey(): string {
  const raw = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
  return raw.split('#')[0].trim()
}

