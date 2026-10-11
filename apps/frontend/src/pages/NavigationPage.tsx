import { useEffect, useRef, useState } from 'react';
import styles from './NavigationPage.module.css';

interface NavigationPageProps {
  onBack?: () => void;
}

interface PlaceItem {
  placeId: string;
  main: string;
  sub: string;
  lat?: number;
  lng?: number;
  availableLots?: number;
}

interface RouteInfo {
  summary: string;
  durationMinutes: number;
  distanceKm: number;
  traffic: 'Light' | 'Moderate' | 'Heavy';
  path: google.maps.LatLng[] | { lat: number; lng: number }[];
}

interface WalkingInfo {
  durationMinutes: number;
  distanceMeters: number;
  path: google.maps.LatLng[] | { lat: number; lng: number }[];
}

// Default locations
const SAMPLE_ORIGIN = { lat: 1.3650, lng: 103.8320, name: 'Current Location (Ang Mo Kio Ave 1)' };
const DEFAULT_CARPARK = { lat: 1.3585, lng: 103.8375, name: 'Sin Ming Multi-Storey Carpark', availableLots: 48 };
const DEFAULT_DESTINATION = { lat: 1.3520, lng: 103.8360, name: 'MacRitchie Reservoir Park' };

// Curated Singapore Starting Points
const POPULAR_ORIGINS: PlaceItem[] = [
  { placeId: 'orig-1', main: 'My Current Location (GPS)', sub: 'Tap to locate your device' },
  { placeId: 'orig-2', main: 'NTU Campus (Hall 12 / North Spine)', sub: '50 Nanyang Ave, Singapore', lat: 1.3483, lng: 103.6831 },
  { placeId: 'orig-3', main: 'Ang Mo Kio Ave 1', sub: 'Ang Mo Kio, Singapore', lat: 1.3650, lng: 103.8320 },
  { placeId: 'orig-4', main: 'Jurong East MRT Station', sub: '10 Jurong East St 12, Singapore', lat: 1.3331, lng: 103.7423 },
  { placeId: 'orig-5', main: 'Tampines Mall', sub: '4 Tampines Central 5, Singapore', lat: 1.3526, lng: 103.9452 },
  { placeId: 'orig-6', main: 'Orchard Road', sub: 'Orchard Rd, Singapore', lat: 1.3048, lng: 103.8318 },
];

// Curated Singapore Carparks (with SRS lot availability)
const POPULAR_CARPARKS: PlaceItem[] = [
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

// Curated Singapore destinations
const POPULAR_DESTINATIONS: PlaceItem[] = [
  { placeId: 'dest-1', main: 'MacRitchie Reservoir Park', sub: 'MacRitchie Reservoir Park, Singapore', lat: 1.3520, lng: 103.8360 },
  { placeId: 'dest-2', main: 'Bishan Junction 8 Mall', sub: '9 Bishan Pl, Singapore 579837', lat: 1.3506, lng: 103.8488 },
  { placeId: 'dest-3', main: 'Bishan-Ang Mo Kio Park', sub: '1384 Ang Mo Kio Ave 1, Singapore', lat: 1.3634, lng: 103.8436 },
  { placeId: 'dest-4', main: 'Orchard Road (ION Orchard)', sub: '2 Orchard Turn, Singapore 238801', lat: 1.3048, lng: 103.8318 },
  { placeId: 'dest-5', main: 'Marina Bay Sands', sub: '10 Bayfront Ave, Singapore 018956', lat: 1.2834, lng: 103.8607 },
  { placeId: 'dest-6', main: 'NTU North Spine Plaza', sub: '50 Nanyang Ave, Singapore 639798', lat: 1.3483, lng: 103.6831 },
];

// Initial route coordinates for instant load
const INITIAL_DRIVING_PATH = [
  { lat: 1.3650, lng: 103.8320 },
  { lat: 1.3630, lng: 103.8340 },
  { lat: 1.3600, lng: 103.8360 },
  { lat: 1.3585, lng: 103.8375 },
];

const INITIAL_WALKING_PATH = [
  { lat: 1.3585, lng: 103.8375 },
  { lat: 1.3550, lng: 103.8370 },
  { lat: 1.3520, lng: 103.8360 },
];

// Haversine formula to estimate distance in km when offline
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function NavigationPage({ onBack }: NavigationPageProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const carparkMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const drivingPolylineRef = useRef<google.maps.Polyline | null>(null);
  const walkingPolylineRef = useRef<google.maps.Polyline | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(
    apiKey ? null : 'VITE_GOOGLE_MAPS_API_KEY is not configured in .env'
  );
  const [originLocation, setOriginLocation] = useState(SAMPLE_ORIGIN);
  const [carparkLocation, setCarparkLocation] = useState(DEFAULT_CARPARK);
  const [destinationLocation, setDestinationLocation] = useState(DEFAULT_DESTINATION);
  const [isLocating, setIsLocating] = useState(false);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Target Mode state: choosing Start (A), Carpark (P), or Destination (B)
  const [searchTarget, setSearchTarget] = useState<'origin' | 'carpark' | 'destination'>('destination');

  // Dynamic route state
  const [drivingRoutes, setDrivingRoutes] = useState<RouteInfo[]>([
    {
      summary: 'via Sin Ming Rd',
      durationMinutes: 8,
      distanceKm: 2.8,
      traffic: 'Moderate',
      path: INITIAL_DRIVING_PATH,
    },
    {
      summary: 'via Marymount Rd',
      durationMinutes: 11,
      distanceKm: 3.5,
      traffic: 'Light',
      path: [
        { lat: 1.3650, lng: 103.8320 },
        { lat: 1.3660, lng: 103.8390 },
        { lat: 1.3610, lng: 103.8400 },
        { lat: 1.3585, lng: 103.8375 },
      ],
    },
  ]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);

  const [walkingInfo, setWalkingInfo] = useState<WalkingInfo>({
    durationMinutes: 4,
    distanceMeters: 350,
    path: INITIAL_WALKING_PATH,
  });

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const targetPresetList =
    searchTarget === 'origin'
      ? POPULAR_ORIGINS
      : searchTarget === 'carpark'
      ? POPULAR_CARPARKS
      : POPULAR_DESTINATIONS;
  const activeSuggestions = searchQuery.trim() ? suggestions : targetPresetList;

  const currentDriving = drivingRoutes[activeRouteIndex] || drivingRoutes[0];
  const totalDurationMinutes = (currentDriving?.durationMinutes || 0) + (walkingInfo?.durationMinutes || 0);

  // 1. Auto-acquire live GPS position on mount so Pin A starts as current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const rawLat = position.coords.latitude;
          const rawLng = position.coords.longitude;
          const inSingapore = rawLat >= 1.15 && rawLat <= 1.48 && rawLng >= 103.55 && rawLng <= 104.05;
          const lat = inSingapore ? rawLat : 1.3483;
          const lng = inSingapore ? rawLng : 103.6831;
          const name = inSingapore ? 'My Current Location' : 'Current Location (NTU Campus)';

          const newOrigin = { lat, lng, name };
          setOriginLocation(newOrigin);

          if (originMarkerRef.current) {
            originMarkerRef.current.setPosition({ lat, lng });
            originMarkerRef.current.setTitle(name);
          }
          setIsLocating(false);
        },
        (err) => {
          console.warn('Auto-location error:', err.message);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // 2. Initialize Google Maps
  useEffect(() => {
    if (!apiKey) {
      return;
    }

    if (window.google?.maps) {
      initMap();
      return;
    }

    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initMap();
      };
      script.onerror = () => {
        setMapError('Google Maps script could not be loaded. Please check network/key permissions.');
      };
      document.head.appendChild(script);
    } else {
      script.addEventListener('load', initMap);
    }

    function initMap() {
      if (!mapRef.current || !window.google?.maps || mapInstanceRef.current) return;

      try {
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 1.3585, lng: 103.8375 },
          zoom: 14,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
        });
        mapInstanceRef.current = map;

        // Driving Polyline (Blue)
        drivingPolylineRef.current = new window.google.maps.Polyline({
          path: INITIAL_DRIVING_PATH,
          geodesic: true,
          strokeColor: '#2563EB',
          strokeOpacity: 0.95,
          strokeWeight: 6,
          map: map,
        });

        // Walking Polyline (Green dashed)
        walkingPolylineRef.current = new window.google.maps.Polyline({
          path: INITIAL_WALKING_PATH,
          geodesic: true,
          strokeColor: '#10B981',
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map: map,
        });

        // Origin Marker (A)
        originMarkerRef.current = new window.google.maps.Marker({
          position: originLocation,
          map: map,
          title: originLocation.name,
          label: { text: 'A', color: 'white', fontWeight: 'bold' },
        });

        // Carpark Marker (P)
        carparkMarkerRef.current = new window.google.maps.Marker({
          position: DEFAULT_CARPARK,
          map: map,
          title: DEFAULT_CARPARK.name,
          label: { text: 'P', color: '#78350F', fontWeight: 'bold' },
        });

        // Destination Marker (B)
        destMarkerRef.current = new window.google.maps.Marker({
          position: DEFAULT_DESTINATION,
          map: map,
          title: DEFAULT_DESTINATION.name,
          label: { text: 'B', color: 'white', fontWeight: 'bold' },
        });

        setMapLoaded(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error rendering Google Map.';
        setMapError(message);
      }
    }
  }, [apiKey, originLocation]);

  // 3. Synchronize active driving route path with Google Maps polyline
  useEffect(() => {
    if (drivingPolylineRef.current && currentDriving?.path) {
      drivingPolylineRef.current.setPath(currentDriving.path);
    }
  }, [currentDriving]);

  // 4. Dynamic Routes Calculation via Google Routes API (New) with fallback
  useEffect(() => {
    let isCancelled = false;

    async function fetchLiveRoutes() {
      setIsCalculatingRoute(true);

      // A. Compute Driving Segment: query our Express backend first
      let calculatedDriveRoutes: RouteInfo[] = [];

      try {
        const driveRes = await fetch(
          `${apiBaseUrl}/routes/driving?originLat=${originLocation.lat}&originLng=${originLocation.lng}&destLat=${carparkLocation.lat}&destLng=${carparkLocation.lng}`
        );

        if (driveRes.ok) {
          const driveData = await driveRes.json();
          let pathCoords: google.maps.LatLng[] | { lat: number; lng: number }[] = [
            originLocation,
            carparkLocation,
          ];
          if (driveData.polyline && window.google?.maps?.geometry?.encoding) {
            pathCoords = window.google.maps.geometry.encoding.decodePath(driveData.polyline);
          }

          calculatedDriveRoutes.push({
            summary: driveData.summary || 'Primary Route',
            durationMinutes: driveData.durationMinutes,
            distanceKm: parseFloat((driveData.distanceMeters / 1000).toFixed(1)),
            traffic: driveData.trafficStatus || 'Light',
            path: pathCoords,
          });

          if (driveData.alternatives && Array.isArray(driveData.alternatives)) {
            driveData.alternatives.forEach((alt: {
              polyline?: string;
              summary?: string;
              durationMinutes: number;
              distanceMeters: number;
              trafficStatus?: 'Light' | 'Moderate' | 'Heavy';
            }) => {
              let altPath = pathCoords;
              if (alt.polyline && window.google?.maps?.geometry?.encoding) {
                altPath = window.google.maps.geometry.encoding.decodePath(alt.polyline);
              }
              calculatedDriveRoutes.push({
                summary: alt.summary || 'Alternative Route',
                durationMinutes: alt.durationMinutes,
                distanceKm: parseFloat((alt.distanceMeters / 1000).toFixed(1)),
                traffic: alt.trafficStatus || 'Light',
                path: altPath,
              });
            });
          }
        }
      } catch (err) {
        console.warn('Backend /api/routes/driving unreachable, falling back to direct route computation:', err);
      }

      // If backend was unreachable or returned empty, minimal safety fallback
      if (calculatedDriveRoutes.length === 0) {
        const estDist = parseFloat(
          calculateDistanceKm(originLocation.lat, originLocation.lng, carparkLocation.lat, carparkLocation.lng).toFixed(1)
        );
        const estDur = Math.max(2, Math.round((estDist / 35) * 60));
        calculatedDriveRoutes = [
          {
            summary: 'Fastest Route',
            durationMinutes: estDur,
            distanceKm: estDist,
            traffic: 'Moderate',
            path: [originLocation, carparkLocation],
          },
        ];
      }

      // B. Compute Walking Segment: query our Express backend
      let calculatedWalk: WalkingInfo = {
        durationMinutes: 4,
        distanceMeters: 350,
        path: [carparkLocation, destinationLocation],
      };

      try {
        const walkRes = await fetch(
          `${apiBaseUrl}/routes/walking?originLat=${carparkLocation.lat}&originLng=${carparkLocation.lng}&destLat=${destinationLocation.lat}&destLng=${destinationLocation.lng}`
        );

        if (walkRes.ok) {
          const walkData = await walkRes.json();
          let walkCoords: google.maps.LatLng[] | { lat: number; lng: number }[] = [
            carparkLocation,
            destinationLocation,
          ];
          if (walkData.polyline && window.google?.maps?.geometry?.encoding) {
            walkCoords = window.google.maps.geometry.encoding.decodePath(walkData.polyline);
          }

          calculatedWalk = {
            durationMinutes: walkData.durationMinutes,
            distanceMeters: walkData.distanceMeters,
            path: walkCoords,
          };
        }
      } catch (err) {
        console.warn('Backend /api/routes/walking unreachable:', err);
      }

      if (!isCancelled) {
        setDrivingRoutes(calculatedDriveRoutes);
        setActiveRouteIndex(0);
        setWalkingInfo(calculatedWalk);
        setIsCalculatingRoute(false);

        // Update polylines on Google Map
        if (drivingPolylineRef.current && calculatedDriveRoutes[0]) {
          drivingPolylineRef.current.setPath(calculatedDriveRoutes[0].path);
        }
        if (walkingPolylineRef.current) {
          walkingPolylineRef.current.setPath(calculatedWalk.path);
        }

        // Adjust map camera view to fit entire journey if map is ready
        if (mapInstanceRef.current && window.google?.maps) {
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend({ lat: originLocation.lat, lng: originLocation.lng });
          bounds.extend({ lat: carparkLocation.lat, lng: carparkLocation.lng });
          bounds.extend({ lat: destinationLocation.lat, lng: destinationLocation.lng });
          mapInstanceRef.current.fitBounds(bounds, 50);
        }
      }
    }

    fetchLiveRoutes();

    return () => {
      isCancelled = true;
    };
  }, [originLocation, carparkLocation, destinationLocation, apiBaseUrl]);

  // 5. Real-time debounced search using Google Places API (New) with fallback
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const queryTerm = searchTarget === 'carpark' ? `${searchQuery} carpark` : searchQuery;
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
          },
          body: JSON.stringify({
            input: queryTerm,
            includedRegionCodes: ['sg'],
          }),
        });

        const data = await res.json();
        if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          interface PlacePrediction {
            placeId?: string;
            place?: string;
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
            text?: { text?: string };
          }
          const formatted: PlaceItem[] = data.suggestions.map((item: { placePrediction: PlacePrediction }) => ({
            placeId: item.placePrediction.placeId || item.placePrediction.place || '',
            main: item.placePrediction.structuredFormat?.mainText?.text || item.placePrediction.text?.text || 'Location',
            sub: item.placePrediction.structuredFormat?.secondaryText?.text || 'Singapore',
          }));
          setSuggestions(formatted);
          setShowDropdown(true);
        } else {
          // Local fallback filter
          const fallbackSource =
            searchTarget === 'origin'
              ? POPULAR_ORIGINS
              : searchTarget === 'carpark'
              ? POPULAR_CARPARKS
              : POPULAR_DESTINATIONS;
          const matches = fallbackSource.filter((d) =>
            d.main.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSuggestions(matches);
          setShowDropdown(matches.length > 0);
        }
      } catch {
        const fallbackSource =
          searchTarget === 'origin'
            ? POPULAR_ORIGINS
            : searchTarget === 'carpark'
            ? POPULAR_CARPARKS
            : POPULAR_DESTINATIONS;
        const matches = fallbackSource.filter((d) =>
          d.main.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSuggestions(matches);
        setShowDropdown(matches.length > 0);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, searchTarget, apiKey]);

  // 6. Handle acquiring user current location (GPS)
  const handleGetCurrentLocation = () => {
    setIsLocating(true);
    setShowDropdown(false);

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawLat = position.coords.latitude;
        const rawLng = position.coords.longitude;

        const inSingapore = rawLat >= 1.15 && rawLat <= 1.48 && rawLng >= 103.55 && rawLng <= 104.05;
        const lat = inSingapore ? rawLat : 1.3483;
        const lng = inSingapore ? rawLng : 103.6831;
        const name = inSingapore ? 'My Current Location' : 'Current Location (NTU Campus)';

        const newOrigin = { lat, lng, name };
        setOriginLocation(newOrigin);

        if (originMarkerRef.current) {
          originMarkerRef.current.setPosition({ lat, lng });
          originMarkerRef.current.setTitle(name);
        }

        setIsLocating(false);
      },
      (error) => {
        console.warn('Geolocation unavailable/blocked, using NTU campus demo location:', error.message);
        const fallbackOrigin = {
          lat: 1.3483,
          lng: 103.6831,
          name: 'My Location (NTU Campus)',
        };
        setOriginLocation(fallbackOrigin);

        if (originMarkerRef.current) {
          originMarkerRef.current.setPosition(fallbackOrigin);
          originMarkerRef.current.setTitle(fallbackOrigin.name);
        }

        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 7. Handle selecting an Origin (A), Carpark (P), or Destination (B)
  const handleSelectPlace = async (place: PlaceItem) => {
    // If user clicked the GPS shortcut in dropdown
    if (place.placeId === 'orig-1') {
      handleGetCurrentLocation();
      return;
    }

    setShowDropdown(false);
    setSearchQuery('');
    setIsSearching(true);

    let lat = place.lat;
    let lng = place.lng;
    const name = place.main;

    // Fetch place details coordinates if not already present
    if (
      (lat === undefined || lng === undefined) &&
      place.placeId &&
      !place.placeId.startsWith('dest') &&
      !place.placeId.startsWith('cp') &&
      !place.placeId.startsWith('orig')
    ) {
      try {
        const detailRes = await fetch(
          `https://places.googleapis.com/v1/places/${place.placeId}?fields=id,displayName,location&key=${apiKey}`
        );
        const detailData = await detailRes.json();
        if (detailData.location?.latitude && detailData.location?.longitude) {
          lat = detailData.location.latitude;
          lng = detailData.location.longitude;
        }
      } catch (err) {
        console.error('Failed to fetch place details:', err);
      }
    }

    setIsSearching(false);

    if (lat !== undefined && lng !== undefined) {
      if (searchTarget === 'origin') {
        const newOrigin = { lat, lng, name };
        setOriginLocation(newOrigin);

        if (originMarkerRef.current) {
          originMarkerRef.current.setPosition({ lat, lng });
          originMarkerRef.current.setTitle(name);
        }
      } else if (searchTarget === 'carpark') {
        const newCp = {
          lat,
          lng,
          name,
          availableLots: place.availableLots ?? 42,
        };
        setCarparkLocation(newCp);

        if (carparkMarkerRef.current) {
          carparkMarkerRef.current.setPosition({ lat, lng });
          carparkMarkerRef.current.setTitle(name);
        }
      } else {
        const newDest = { lat, lng, name };
        setDestinationLocation(newDest);

        if (destMarkerRef.current) {
          destMarkerRef.current.setPosition({ lat, lng });
          destMarkerRef.current.setTitle(name);
        }
      }
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.phoneFrame}>


      {/* Floating Top Actions Row (☰ on left, ... on right) */}
      <div className={styles.topHeaderRow}>
        <button
          className={styles.iconButton}
          onClick={onBack || (() => window.history.back())}
          title="Menu / Return"
        >
          ☰
        </button>
        <button className={styles.iconButton} title="More Options">
          •••
        </button>
      </div>

      {/* Floating Search & Target Switcher Container on the Map */}
      <div ref={searchContainerRef} className={styles.searchCardContainer}>
        {/* Triple Mode Switcher: Start (A), Carpark (P), Destination (B) */}
        <div className={styles.targetTabs}>
          <button
            type="button"
            className={`${styles.targetTab} ${searchTarget === 'origin' ? styles.targetTabActive : ''}`}
            onClick={() => {
              setSearchTarget('origin');
              setSearchQuery('');
              setShowDropdown(true);
            }}
          >
            📍 Start (A)
          </button>
          <button
            type="button"
            className={`${styles.targetTab} ${searchTarget === 'carpark' ? styles.targetTabActive : ''}`}
            onClick={() => {
              setSearchTarget('carpark');
              setSearchQuery('');
              setShowDropdown(true);
            }}
          >
            🅿️ Carpark (P)
          </button>
          <button
            type="button"
            className={`${styles.targetTab} ${searchTarget === 'destination' ? styles.targetTabActive : ''}`}
            onClick={() => {
              setSearchTarget('destination');
              setSearchQuery('');
              setShowDropdown(true);
            }}
          >
            🏁 Dest (B)
          </button>
        </div>

        {/* Search Capsule Input */}
        <div className={styles.searchCapsule}>
          <span className={styles.searchIcon}>
            {searchTarget === 'origin' ? '📍' : searchTarget === 'carpark' ? '🅿️' : '🏁'}
          </span>
          <input
            type="text"
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            placeholder={
              searchTarget === 'origin'
                ? `Start: ${originLocation.name}`
                : searchTarget === 'carpark'
                ? `Carpark: ${carparkLocation.name}`
                : `Destination: ${destinationLocation.name}`
            }
          />
          {searchQuery ? (
            <span
              className={styles.filterIcon}
              onClick={() => {
                setSearchQuery('');
                setShowDropdown(false);
              }}
              title="Clear"
            >
              ✕
            </span>
          ) : (
            <span className={styles.filterIcon} title="Filters">
              🎚️
            </span>
          )}
        </div>

        {/* Suggestion Dropdown */}
        {showDropdown && (
          <div className={styles.suggestionsDropdown}>
            {/* Quick Option: Use Current Location (always accessible) */}
            <div
              className={styles.currentLocationOption}
              onClick={handleGetCurrentLocation}
            >
              <span className={styles.currentLocationIcon}>🎯</span>
              <div className={styles.currentLocationText}>
                <div className={styles.currentLocationMain}>Use My Current Location</div>
                <div className={styles.currentLocationSub}>GPS positioning for Start Point (A)</div>
              </div>
            </div>

            <div style={{ padding: '6px 16px 2px', fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>
              {searchTarget === 'origin'
                ? 'Popular Starting Points (A)'
                : searchTarget === 'carpark'
                ? 'Popular Singapore Carparks (P)'
                : 'Popular Destinations (B)'}
            </div>

            {isSearching && (
              <div style={{ padding: '8px 16px', fontSize: '12px', color: '#6B7280' }}>
                Searching Google Places Singapore...
              </div>
            )}

            {activeSuggestions.map((item) => (
              <div
                key={item.placeId + item.main}
                className={styles.suggestionItem}
                onClick={() => handleSelectPlace(item)}
              >
                <span className={styles.suggestionIcon}>
                  {searchTarget === 'origin' ? '📍' : searchTarget === 'carpark' ? '🅿️' : '🏁'}
                </span>
                <div className={styles.suggestionText}>
                  <div className={styles.suggestionMain}>{item.main}</div>
                  <div className={styles.suggestionSecondary}>{item.sub}</div>
                </div>
                {item.availableLots !== undefined && (
                  <span className={styles.lotBadge}>
                    🟢 {item.availableLots} lots
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-Bleed Google Maps Canvas */}
      <div ref={mapRef} className={styles.mapContainer} />

      {/* Loading state before Google Maps tiles appear */}
      {!mapLoaded && !mapError && (
        <div className={styles.mapLoading}>
          <span>📍 Loading Google Maps Singapore...</span>
        </div>
      )}

      {/* Fallback notice if Google Maps JS script fails or API key quota exceeded */}
      {mapError && (
        <div className={styles.mapLoading}>
          <span>📍 {mapError}</span>
          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Showing navigation controls below</span>
        </div>
      )}

      {/* Floating My Location GPS Button */}
      <button
        type="button"
        className={`${styles.myLocationButton} ${isLocating ? styles.locating : ''} ${
          isSheetCollapsed ? styles.myLocationButtonCollapsed : ''
        }`}
        onClick={handleGetCurrentLocation}
        title="Get Current Location (GPS)"
      >
        {isLocating ? '⏳' : '⌖'}
      </button>

      {/* Floating Navigation Bottom Sheet (Xavier's Scope) */}
      <div className={`${styles.bottomSheet} ${isSheetCollapsed ? styles.sheetCollapsed : ''}`}>
        {/* Drag handle to toggle collapse */}
        <div
          className={styles.sheetHandle}
          onClick={() => setIsSheetCollapsed((prev) => !prev)}
          title={isSheetCollapsed ? 'Expand navigation details' : 'Collapse navigation details'}
        />

        {/* Sheet Header row: Clickable to toggle */}
        <div
          className={`${styles.sheetHeader} ${!isSheetCollapsed ? styles.sheetHeaderExpanded : ''}`}
          onClick={() => setIsSheetCollapsed((prev) => !prev)}
        >
          <div className={styles.totalEta}>
            {isCalculatingRoute ? (
              <span style={{ fontSize: '1.1rem', color: '#6B7280' }}>Calculating ETA...</span>
            ) : (
              <>
                {totalDurationMinutes}{' '}
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280' }}>mins total</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              className={`${styles.trafficBadge} ${
                currentDriving.traffic === 'Moderate'
                  ? styles.trafficModerate
                  : styles.trafficLight
              }`}
            >
              {currentDriving.traffic} traffic
            </span>
            <span className={styles.sheetToggleChevron}>
              {isSheetCollapsed ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {/* Expanded Body: Hidden when collapsed */}
        {!isSheetCollapsed && (
          <>
            <div className={styles.tripDetails}>
              {/* Tappable Origin Row */}
              <div
                className={styles.clickableTripRow}
                style={{ marginBottom: '3px' }}
                onClick={() => {
                  setSearchTarget('origin');
                  setSearchQuery('');
                  setShowDropdown(true);
                }}
                title="Tap to change Start Location (A)"
              >
                <div>
                  📍 <strong>Start (A):</strong> {originLocation.name}
                </div>
                <span className={styles.changeTag}>Change A</span>
              </div>

              {/* Tappable Carpark Row */}
              <div
                className={styles.clickableTripRow}
                onClick={() => {
                  setSearchTarget('carpark');
                  setSearchQuery('');
                  setShowDropdown(true);
                }}
                title="Tap to change Carpark (P)"
              >
                <div>
                  🚗 <strong>{currentDriving.durationMinutes} mins</strong> drive ({currentDriving.distanceKm} km) ➔ <strong>{carparkLocation.name}</strong>
                </div>
                <span className={styles.changeTag}>Change P</span>
              </div>

              {/* Tappable Destination Row */}
              <div
                className={styles.clickableTripRow}
                style={{ marginTop: '3px' }}
                onClick={() => {
                  setSearchTarget('destination');
                  setSearchQuery('');
                  setShowDropdown(true);
                }}
                title="Tap to change Destination (B)"
              >
                <div>
                  🚶 <strong>{walkingInfo.durationMinutes} mins</strong> walk ({walkingInfo.distanceMeters >= 1000 ? `${(walkingInfo.distanceMeters / 1000).toFixed(1)} km` : `${walkingInfo.distanceMeters} m`}) ➔ <strong>{destinationLocation.name}</strong>
                </div>
                <span className={styles.changeTag}>Change B</span>
              </div>
            </div>

            {/* Alternative Routes Selector (FR34) */}
            <div className={styles.routeButtonGroup}>
              {drivingRoutes.map((route, idx) => (
                <button
                  key={route.summary + idx}
                  type="button"
                  className={`${styles.routeBtn} ${activeRouteIndex === idx ? styles.routeBtnActive : ''}`}
                  onClick={() => {
                    setActiveRouteIndex(idx);
                    if (drivingPolylineRef.current) {
                      drivingPolylineRef.current.setPath(route.path);
                    }
                  }}
                >
                  <div className={styles.routeBtnTitle}>{route.summary}</div>
                  <div className={styles.routeBtnDuration}>
                    {route.durationMinutes} mins · {route.distanceKm} km
                  </div>
                </button>
              ))}
            </div>

            {/* Action Row: Cancel button + Weather slot */}
            <div className={styles.sheetActions}>
              <button
                type="button"
                onClick={onBack || (() => window.history.back())}
                className={styles.cancelBtn}
              >
                Cancel Nav
              </button>
              <div className={styles.weatherSlot}>
                ⛅ <span>Moufooza's Weather slot</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fixed Bottom Navigation Bar (Explore, Saved, Profile) */}
    
    </div>
  );
}

export default NavigationPage;

