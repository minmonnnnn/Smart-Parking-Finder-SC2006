import { useEffect, useRef, useState } from 'react';
import styles from '../../../pages/NavigationPage.module.css';
import { INITIAL_DRIVING_PATH, INITIAL_WALKING_PATH } from '../constants';

interface NavigationMapProps {
  origin: { lat: number; lng: number; name: string };
  carpark: { lat: number; lng: number; name: string };
  destination: { lat: number; lng: number; name: string };
  drivingPath?: google.maps.LatLng[] | { lat: number; lng: number }[];
  walkingPath?: google.maps.LatLng[] | { lat: number; lng: number }[];
  isLocating: boolean;
  isSheetCollapsed: boolean;
  onGetCurrentLocation: () => void;
}

export function NavigationMap({
  origin,
  carpark,
  destination,
  drivingPath,
  walkingPath,
  isLocating,
  isSheetCollapsed,
  onGetCurrentLocation,
}: NavigationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const carparkMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const drivingPolylineRef = useRef<google.maps.Polyline | null>(null);
  const walkingPolylineRef = useRef<google.maps.Polyline | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(
    apiKey ? null : 'VITE_GOOGLE_MAPS_API_KEY is not configured in .env'
  );

  // Initialize Google Maps
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
          center: { lat: carpark.lat, lng: carpark.lng },
          zoom: 14,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
        });
        mapInstanceRef.current = map;

        // Driving Polyline (Blue)
        drivingPolylineRef.current = new window.google.maps.Polyline({
          path: drivingPath || INITIAL_DRIVING_PATH,
          geodesic: true,
          strokeColor: '#2563EB',
          strokeOpacity: 0.95,
          strokeWeight: 6,
          map: map,
        });

        // Walking Polyline (Green dashed)
        walkingPolylineRef.current = new window.google.maps.Polyline({
          path: walkingPath || INITIAL_WALKING_PATH,
          geodesic: true,
          strokeColor: '#10B981',
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map: map,
        });

        // Origin Marker (A)
        originMarkerRef.current = new window.google.maps.Marker({
          position: origin,
          map: map,
          title: origin.name,
          label: { text: 'A', color: 'white', fontWeight: 'bold' },
        });

        // Carpark Marker (P)
        carparkMarkerRef.current = new window.google.maps.Marker({
          position: carpark,
          map: map,
          title: carpark.name,
          label: { text: 'P', color: '#78350F', fontWeight: 'bold' },
        });

        // Destination Marker (B)
        destMarkerRef.current = new window.google.maps.Marker({
          position: destination,
          map: map,
          title: destination.name,
          label: { text: 'B', color: 'white', fontWeight: 'bold' },
        });

        setMapLoaded(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error rendering Google Map.';
        setMapError(message);
      }
    }
  }, [apiKey, origin, carpark, destination, drivingPath, walkingPath]);

  // Synchronize driving route path with polyline
  useEffect(() => {
    if (drivingPolylineRef.current && drivingPath) {
      drivingPolylineRef.current.setPath(drivingPath);
    }
  }, [drivingPath]);

  // Synchronize walking route path with polyline
  useEffect(() => {
    if (walkingPolylineRef.current && walkingPath) {
      walkingPolylineRef.current.setPath(walkingPath);
    }
  }, [walkingPath]);

  // Synchronize marker positions and map camera bounds
  useEffect(() => {
    if (originMarkerRef.current) {
      originMarkerRef.current.setPosition({ lat: origin.lat, lng: origin.lng });
      originMarkerRef.current.setTitle(origin.name);
    }
    if (carparkMarkerRef.current) {
      carparkMarkerRef.current.setPosition({ lat: carpark.lat, lng: carpark.lng });
      carparkMarkerRef.current.setTitle(carpark.name);
    }
    if (destMarkerRef.current) {
      destMarkerRef.current.setPosition({ lat: destination.lat, lng: destination.lng });
      destMarkerRef.current.setTitle(destination.name);
    }

    if (mapInstanceRef.current && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: origin.lat, lng: origin.lng });
      bounds.extend({ lat: carpark.lat, lng: carpark.lng });
      bounds.extend({ lat: destination.lat, lng: destination.lng });
      mapInstanceRef.current.fitBounds(bounds, 50);
    }
  }, [origin, carpark, destination]);

  return (
    <>
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
          <span className={styles.mapLoadingNotice}>Showing navigation controls below</span>
        </div>
      )}

      {/* Floating My Location GPS Button */}
      <button
        type="button"
        className={`${styles.myLocationButton} ${isLocating ? styles.locating : ''} ${
          isSheetCollapsed ? styles.myLocationButtonCollapsed : ''
        }`}
        onClick={onGetCurrentLocation}
        title="Get Current Location (GPS)"
      >
        {isLocating ? '⏳' : '⌖'}
      </button>
    </>
  );
}

