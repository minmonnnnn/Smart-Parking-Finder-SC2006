import { useEffect, useRef } from 'react';
import { useLoadScript } from '@react-google-maps/api';
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES, getGoogleMapsApiKey } from '../../../lib/googleMaps';
import styles from '../../../pages/NavigationPage.module.css';
import { theme } from '../../../components/theme';
import { INITIAL_DRIVING_PATH, INITIAL_WALKING_PATH } from '../constants';
import { CrosshairIcon, LoaderIcon } from '../../../components/icons';

interface NavigationMapProps {
  origin: { lat: number; lng: number; name: string };
  carpark: { lat: number; lng: number; name: string };
  destination: { lat: number; lng: number; name: string };
  drivingPath?: google.maps.LatLng[] | { lat: number; lng: number }[];
  walkingPath?: google.maps.LatLng[] | { lat: number; lng: number }[];
  isLocating: boolean;
  isSheetCollapsed: boolean;
  isSheetVisible?: boolean;
  showCarparksList?: boolean;
  onGetCurrentLocation: () => void;
  isSimulating?: boolean;
}

export function NavigationMap({
  origin,
  carpark,
  destination,
  drivingPath,
  walkingPath,
  isLocating,
  isSheetCollapsed,
  isSheetVisible = true,
  showCarparksList = false,
  onGetCurrentLocation,
  isSimulating = false,
}: NavigationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const carparkMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const drivingPolylineRef = useRef<google.maps.Polyline | null>(null);
  const walkingPolylineRef = useRef<google.maps.Polyline | null>(null);

  const apiKey = getGoogleMapsApiKey();

  const { isLoaded, loadError } = useLoadScript({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapError = !apiKey
    ? 'VITE_GOOGLE_MAPS_API_KEY is not configured in .env'
    : loadError
    ? 'Google Maps script could not be loaded. Please check network/key permissions.'
    : null;

  //initialize google maps
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current || !window.google?.maps) return;

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: carpark.lat, lng: carpark.lng },
        zoom: 14,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
      });
      mapInstanceRef.current = map;

      //driving Polyline blue
      drivingPolylineRef.current = new window.google.maps.Polyline({
        path: drivingPath || INITIAL_DRIVING_PATH,
        geodesic: true,
        strokeColor: theme.color.secondary,
        strokeOpacity: 0.95,
        strokeWeight: 6,
        map: map,
      });

      //walking Polyline green
      walkingPolylineRef.current = new window.google.maps.Polyline({
        path: walkingPath || INITIAL_WALKING_PATH,
        geodesic: true,
        strokeColor: theme.color.success,
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map: map,
      });

      //starting marker (A)
      originMarkerRef.current = new window.google.maps.Marker({
        position: origin,
        map: map,
        title: origin.name,
        label: { text: 'A', color: 'white', fontWeight: 'bold' },
      });

      //carpark marker (P)
      carparkMarkerRef.current = new window.google.maps.Marker({
        position: carpark,
        map: map,
        title: carpark.name,
        label: { text: 'P', color: '#78350F', fontWeight: 'bold' },
      });

      //Destination Marker (B)
      destMarkerRef.current = new window.google.maps.Marker({
        position: destination,
        map: map,
        title: destination.name,
        label: { text: 'B', color: 'white', fontWeight: 'bold' },
      });
    } catch (err: unknown) {
      console.error('Error rendering Google Map:', err);
    }
  }, [isLoaded, origin, carpark, destination, drivingPath, walkingPath]);

  //synchronise driving route path with polyline
  useEffect(() => {
    if (drivingPolylineRef.current) {
      const path = drivingPath && (drivingPath as unknown[]).length > 0 ? drivingPath : [];
      drivingPolylineRef.current.setPath(path);
      drivingPolylineRef.current.setVisible(path.length > 0);
    }
  }, [drivingPath]);

  //synchronise walking route path with polyline
  useEffect(() => {
    if (walkingPolylineRef.current) {
      walkingPolylineRef.current.setPath(walkingPath || []);
    }
  }, [walkingPath]);

  //synchronise marker positions, visibility, and map camera bounds
  useEffect(() => {
    if (originMarkerRef.current) {
      originMarkerRef.current.setPosition({ lat: origin.lat, lng: origin.lng });
      originMarkerRef.current.setTitle(origin.name);
    }
    if (carparkMarkerRef.current) {
      carparkMarkerRef.current.setPosition({ lat: carpark.lat, lng: carpark.lng });
      carparkMarkerRef.current.setTitle(carpark.name);
      carparkMarkerRef.current.setVisible(isSheetVisible);
    }
    const isDirectCarpark = Math.hypot(carpark.lat - destination.lat, carpark.lng - destination.lng) < 0.0005;
    if (destMarkerRef.current) {
      destMarkerRef.current.setPosition({ lat: destination.lat, lng: destination.lng });
      destMarkerRef.current.setTitle(destination.name);
      destMarkerRef.current.setVisible((isSheetVisible || Boolean(showCarparksList)) && !isDirectCarpark);
    }

    if (mapInstanceRef.current && window.google?.maps) {
      try {
        const isValidCoord = (c?: { lat?: number; lng?: number }) =>
          typeof c?.lat === 'number' && !isNaN(c.lat) && typeof c?.lng === 'number' && !isNaN(c.lng);

        if (isSimulating && isValidCoord(origin)) {
          // During simulation: follow the marker at a fixed zoom so polyline trimming is visible
          mapInstanceRef.current.setCenter({ lat: origin.lat, lng: origin.lng });
          mapInstanceRef.current.setZoom(16);
        } else if (isSheetVisible && isValidCoord(origin) && isValidCoord(carpark) && isValidCoord(destination)) {
          const lats = [origin.lat, carpark.lat, destination.lat];
          const lngs = [origin.lng, carpark.lng, destination.lng];
          mapInstanceRef.current.fitBounds({
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs),
          }, 50);
        } else if (showCarparksList && isValidCoord(origin) && isValidCoord(destination)) {
          const lats = [origin.lat, destination.lat];
          const lngs = [origin.lng, destination.lng];
          mapInstanceRef.current.fitBounds({
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs),
          }, 60);
        } else if (isValidCoord(origin)) {
          mapInstanceRef.current.setCenter({ lat: origin.lat, lng: origin.lng });
          mapInstanceRef.current.setZoom(14);
        }
      } catch (err) {
        console.warn('Map fitBounds warning:', err);
      }
    }
  }, [origin, carpark, destination, isSheetVisible, showCarparksList, isSimulating]);

  return (
    <>
      <div ref={mapRef} className={styles.mapContainer} />
      {!isLoaded && !mapError && (
        <div className={styles.mapLoading}>
          <span>Loading Google Maps</span>
        </div>
      )}

      {mapError && (
        <div className={styles.mapLoading}>
          <span> {mapError}</span>
          <span className={styles.mapLoadingNotice}>Showing navigation controls below</span>
        </div>
      )}

      <button
        type="button"
        className={`${styles.myLocationButton} ${isLocating ? styles.locating : ''} ${
          showCarparksList
            ? styles.myLocationButtonCarparksList
            : !isSheetVisible
            ? styles.myLocationButtonSheetHidden
            : isSheetCollapsed
            ? styles.myLocationButtonCollapsed
            : ''
        }`}
        onClick={onGetCurrentLocation}
        title="Get Current Location (GPS)"
      >
        {isLocating ? <LoaderIcon size={20} className={styles.spinner} /> : <CrosshairIcon size={20} />}
      </button>
    </>
  );
}

