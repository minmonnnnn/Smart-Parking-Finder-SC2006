/**
 * Navigation & Routing Types (Owner: Xavier)
 * Aligned with docs/API_CONTRACT.md and @smart-parking/shared-types
 */

import type { CarparkDetails } from '@smart-parking/shared-types';

export interface PlaceItem {
  placeId: string;
  main: string;
  sub: string;
  name?: string;
  lat?: number;
  lng?: number;
  availableLots?: number;
}

export type NavDestination = PlaceItem & {
  lat: number;
  lng: number;
  name: string;
};

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


export interface NavigationPageProps {
  onBack?: () => void;
  initialCarparkNo?: string | null;
  initialCarparkDetails?: CarparkDetails | null;
  onNavigate?: (page: 'search' | 'favourites' | 'profile' | 'navigation') => void;
  onLogout?: () => void;
}

