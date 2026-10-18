import type { PlaceItem, NavDestination } from './types';

// Default Singapore Locations
export const SAMPLE_ORIGIN = { lat: 1.3650, lng: 103.8320, name: 'Current Location (Ang Mo Kio Ave 1)' };
export const DEFAULT_CARPARK = { lat: 1.3585, lng: 103.8375, name: 'Sin Ming Multi-Storey Carpark', availableLots: 48 };
export const DEFAULT_DESTINATION: NavDestination = {
  placeId: 'dest-default',
  main: 'MacRitchie Reservoir Park',
  sub: 'Singapore',
  name: 'MacRitchie Reservoir Park',
  lat: 1.3520,
  lng: 103.8360,
};

// Curated Singapore Starting Points
export const POPULAR_ORIGINS: PlaceItem[] = [
  { placeId: 'orig-1', main: 'My Current Location (GPS)', sub: 'Tap to locate your device' },
  { placeId: 'orig-2', main: 'NTU Campus (Hall 12 / North Spine)', sub: '50 Nanyang Ave, Singapore', lat: 1.3483, lng: 103.6831 },
  { placeId: 'orig-3', main: 'Ang Mo Kio Ave 1', sub: 'Ang Mo Kio, Singapore', lat: 1.3650, lng: 103.8320 },
  { placeId: 'orig-4', main: 'Jurong East MRT Station', sub: '10 Jurong East St 12, Singapore', lat: 1.3331, lng: 103.7423 },
  { placeId: 'orig-5', main: 'Tampines Mall', sub: '4 Tampines Central 5, Singapore', lat: 1.3526, lng: 103.9452 },
  { placeId: 'orig-6', main: 'Orchard Road', sub: 'Orchard Rd, Singapore', lat: 1.3048, lng: 103.8318 },
];

// Curated Singapore Carparks (with lot availability per SRS)
export const POPULAR_CARPARKS: PlaceItem[] = [
  {
    placeId: 'cp-1',
    main: 'Sin Ming Multi-Storey Carpark',
    sub: 'Blk 23 Sin Ming Rd',
    lat: 1.3585,
    lng: 103.8375,
    availableLots: 48,
  },
  {
    placeId: 'cp-2',
    main: 'Bishan Junction 8 Basement Carpark',
    sub: '9 Bishan Pl, Singapore 579837',
    lat: 1.3506,
    lng: 103.8488,
    availableLots: 112,
  },
  {
    placeId: 'cp-3',
    main: 'MacRitchie Reservoir Public Carpark',
    sub: 'Lornie Rd, Singapore',
    lat: 1.3440,
    lng: 103.8340,
    availableLots: 24,
  },
  {
    placeId: 'cp-4',
    main: 'Bishan-AMK Park Carpark A',
    sub: 'Opp Blk 223 Ang Mo Kio Ave 1',
    lat: 1.3645,
    lng: 103.8465,
    availableLots: 65,
  },
  {
    placeId: 'cp-5',
    main: 'Far East Plaza Carpark',
    sub: '14 Scotts Rd, Singapore 228213',
    lat: 1.3072,
    lng: 103.8335,
    availableLots: 35,
  },
  {
    placeId: 'cp-6',
    main: 'Marina Bay Sands Central Carpark',
    sub: '10 Bayfront Ave, Singapore 018956',
    lat: 1.2828,
    lng: 103.8590,
    availableLots: 210,
  },
  {
    placeId: 'cp-7',
    main: 'NTU Carpark F (Near North Spine)',
    sub: '50 Nanyang Ave, Singapore 639798',
    lat: 1.3475,
    lng: 103.6820,
    availableLots: 88,
  },
];

// Curated Singapore Destinations
export const POPULAR_DESTINATIONS: PlaceItem[] = [
  { placeId: 'dest-1', main: 'MacRitchie Reservoir Park', sub: 'MacRitchie Reservoir Park, Singapore', lat: 1.3520, lng: 103.8360 },
  { placeId: 'dest-2', main: 'Bishan Junction 8 Mall', sub: '9 Bishan Pl, Singapore 579837', lat: 1.3506, lng: 103.8488 },
  { placeId: 'dest-3', main: 'Bishan-Ang Mo Kio Park', sub: '1384 Ang Mo Kio Ave 1, Singapore', lat: 1.3634, lng: 103.8436 },
  { placeId: 'dest-4', main: 'Orchard Road (ION Orchard)', sub: '2 Orchard Turn, Singapore 238801', lat: 1.3048, lng: 103.8318 },
  { placeId: 'dest-5', main: 'Marina Bay Sands', sub: '10 Bayfront Ave, Singapore 018956', lat: 1.2834, lng: 103.8607 },
  { placeId: 'dest-6', main: 'NTU North Spine Plaza', sub: '50 Nanyang Ave, Singapore 639798', lat: 1.3483, lng: 103.6831 },
];

// Initial route coordinates for instant load
export const INITIAL_DRIVING_PATH = [
  { lat: 1.3650, lng: 103.8320 },
  { lat: 1.3630, lng: 103.8340 },
  { lat: 1.3600, lng: 103.8360 },
  { lat: 1.3585, lng: 103.8375 },
];

export const INITIAL_WALKING_PATH = [
  { lat: 1.3585, lng: 103.8375 },
  { lat: 1.3550, lng: 103.8370 },
  { lat: 1.3520, lng: 103.8360 },
];

// Haversine distance helper
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

