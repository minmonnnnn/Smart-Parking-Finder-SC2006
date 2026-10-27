export type TrafficStatus = 'Light' | 'Moderate' | 'Heavy'

export interface DrivingRoute {
  polyline: string
  distanceMeters: number
  durationMinutes: number
  trafficStatus: TrafficStatus
  summary?: string
  alternatives?: DrivingRoute[]
}

export interface WalkingRoute {
  polyline: string
  distanceMeters: number
  durationMinutes: number
}

export interface RouteCoordinates {
  latitude: number
  longitude: number
}

/** Average walking speed used for fallback duration estimates (meters per minute) */
export const WALKING_SPEED_M_PER_MIN = 75

/**
 * Calculates the great-circle distance between two points on the Earth's surface in kilometres using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
