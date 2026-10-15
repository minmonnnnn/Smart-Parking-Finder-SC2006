/**
 * Navigation & Routing Types (Owner: Xavier)
 * Aligned with docs/API_CONTRACT.md and @smart-parking/shared-types
 */

export interface PlaceItem {
  placeId: string;
  main: string;
  sub: string;
  lat?: number;
  lng?: number;
  availableLots?: number;
}

export interface RouteInfo {
  summary: string;
  durationMinutes: number;
  distanceKm: number;
  traffic: 'Light' | 'Moderate' | 'Heavy';
  path: google.maps.LatLng[] | { lat: number; lng: number }[];
}

export interface WalkingInfo {
  durationMinutes: number;
  distanceMeters: number;
  path: google.maps.LatLng[] | { lat: number; lng: number }[];
}

export type SearchTargetMode = 'origin' | 'carpark' | 'destination';

export interface NavigationPageProps {
  onBack?: () => void;
}

