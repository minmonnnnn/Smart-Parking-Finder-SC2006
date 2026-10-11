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

