import { useEffect, useState } from 'react';
import styles from './NavigationPage.module.css';

// Feature Components
import { NavigationMap } from '../features/navigation/components/NavigationMap';
import { RouteSearchCard } from '../features/navigation/components/RouteSearchCard';
import { NavigationBottomSheet } from '../features/navigation/components/NavigationBottomSheet';

// Feature Hooks, Constants & Types
import { useNavigationRoutes } from '../features/navigation/hooks/useNavigationRoutes';
import {
  SAMPLE_ORIGIN,
  DEFAULT_CARPARK,
  DEFAULT_DESTINATION,
} from '../features/navigation/constants';
import type {
  NavigationPageProps,
  PlaceItem,
  SearchTargetMode,
} from '../features/navigation/types';

export function NavigationPage({ onBack }: NavigationPageProps) {
  // Navigation Target Coordinates
  const [originLocation, setOriginLocation] = useState(SAMPLE_ORIGIN);
  const [carparkLocation, setCarparkLocation] = useState(DEFAULT_CARPARK);
  const [destinationLocation, setDestinationLocation] = useState(DEFAULT_DESTINATION);

  // UI View States
  const [isLocating, setIsLocating] = useState(false);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTargetMode>('destination');

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // 1. Auto-acquire live GPS position on mount so Pin A starts as current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const rawLat = position.coords.latitude;
          const rawLng = position.coords.longitude;
          //set the boundary for singapore 
          const inSingapore = rawLat >= 1.15 && rawLat <= 1.48 && rawLng >= 103.55 && rawLng <= 104.05;
          const lat = inSingapore ? rawLat : 1.3483;
          const lng = inSingapore ? rawLng : 103.6831;
          const name = inSingapore ? 'My Current Location' : 'Current Location (NTU Campus)';

          setOriginLocation({ lat, lng, name });
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

  // 2. Fetch routes and alternatives via custom hook

  const {
    drivingRoutes,
    activeRouteIndex,
    setActiveRouteIndex,
    activeDrivingRoute,
    walkingInfo,
    isCalculatingRoute,
  } = useNavigationRoutes({
    origin: originLocation,
    carpark: carparkLocation,
    destination: destinationLocation,
  });

  // 3. Handle GPS Locate Button click
  const handleGetCurrentLocation = () => {
    setIsLocating(true);

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

        setOriginLocation({ lat, lng, name });
        setIsLocating(false);
      },
      (error) => {
        console.warn('Geolocation unavailable/blocked, using NTU campus demo location:', error.message);
        setOriginLocation({
          lat: 1.3483,
          lng: 103.6831,
          name: 'My Location (NTU Campus)',
        });
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 4. Handle selecting a place from dropdown or autocomplete
  const handleSelectPlace = async (place: PlaceItem) => {
    if (place.placeId === 'orig-1') {
      handleGetCurrentLocation();
      return;
    }

    let lat = place.lat;
    let lng = place.lng;
    const name = place.main;

    // Fetch place coordinates if not already present
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

    if (lat !== undefined && lng !== undefined) {
      if (searchTarget === 'origin') {
        setOriginLocation({ lat, lng, name });
      } else if (searchTarget === 'carpark') {
        setCarparkLocation({
          lat,
          lng,
          name,
          availableLots: place.availableLots ?? 42,
        });
      } else {
        setDestinationLocation({ lat, lng, name });
      }
    }
  };

  const currentTargetName =
    searchTarget === 'origin'
      ? originLocation.name
      : searchTarget === 'carpark'
      ? carparkLocation.name
      : destinationLocation.name;

  return (
    <div className={styles.phoneFrame}>
      {/* Floating Top Actions Row */}
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

      {/* Floating Search & Target Switcher Card */}
      <RouteSearchCard
        searchTarget={searchTarget}
        onTargetChange={setSearchTarget}
        currentTargetName={currentTargetName}
        onSelectPlace={handleSelectPlace}
        onGetCurrentLocation={handleGetCurrentLocation}
      />

      {/* Full-Bleed Google Maps Canvas */}
      <NavigationMap
        origin={originLocation}
        carpark={carparkLocation}
        destination={destinationLocation}
        drivingPath={activeDrivingRoute?.path}
        walkingPath={walkingInfo?.path}
        isLocating={isLocating}
        isSheetCollapsed={isSheetCollapsed}
        onGetCurrentLocation={handleGetCurrentLocation}
      />

      {/* Floating Navigation Bottom Sheet */}
      <NavigationBottomSheet
        origin={originLocation}
        carpark={carparkLocation}
        destination={destinationLocation}
        drivingRoutes={drivingRoutes}
        activeRouteIndex={activeRouteIndex}
        onSelectRoute={setActiveRouteIndex}
        walkingInfo={walkingInfo}
        isCalculating={isCalculatingRoute}
        isSheetCollapsed={isSheetCollapsed}
        onToggleCollapse={() => setIsSheetCollapsed((prev) => !prev)}
        onOpenTargetSearch={(target) => setSearchTarget(target)}
        onCancelNav={onBack || (() => window.history.back())}
      />
    </div>
  );
}

export default NavigationPage;
