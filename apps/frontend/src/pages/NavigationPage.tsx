import { useEffect, useState } from 'react';
import styles from './NavigationPage.module.css';

// Feature Components
import { NavigationMap } from '../features/navigation/components/NavigationMap';
import { NavigationBottomSheet } from '../features/navigation/components/NavigationBottomSheet';
import { SearchBar, type AvailabilityLevel, type YesNo } from '../features/search/SearchBar';
import { CarparkCard } from '../features/search/CarparkCard';
import { toCarparkCardData, type CarparkCardData } from '../features/search/carparkCardUtils';

// Feature Hooks, Constants & Types
import { useNavigationRoutes } from '../features/navigation/hooks/useNavigationRoutes';
import { useWeather } from '../features/navigation/hooks/weather';
import {
  SAMPLE_ORIGIN,
  DEFAULT_CARPARK,
  DEFAULT_DESTINATION,
  POPULAR_DESTINATIONS,
  POPULAR_CARPARKS,
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
  const [isSheetVisible, setIsSheetVisible] = useState(true);
  const [, setSearchTarget] = useState<SearchTargetMode>('destination');

  // Recommended Carparks List States
  const [recommendedCarparks, setRecommendedCarparks] = useState<CarparkCardData[]>([]);
  const [showCarparksList, setShowCarparksList] = useState(false);
  const [isLoadingCarparks, setIsLoadingCarparks] = useState(false);

  // Min's Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceItem[]>(POPULAR_DESTINATIONS);
  const [isSearching, setIsSearching] = useState(false);
  const [evFilter, setEvFilter] = useState<YesNo | null>(null);
  const [shelteredFilter, setShelteredFilter] = useState<YesNo | null>(null);
  const [pricingAsc, setPricingAsc] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<Set<AvailabilityLevel>>(new Set());

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

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

  // 3. Fetch live weather for destination area
  const { weather: liveWeather } = useWeather({
    lat: destinationLocation.lat,
    lng: destinationLocation.lng,
  });

  // 4. Handle GPS Locate Button click
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

  // 4. Live Debounced Search (using Min's backend /api/destinations/search with fallbacks)
  useEffect(() => {
    if (!searchQuery.trim()) {
      const resetTimer = setTimeout(() => {
        setSuggestions(POPULAR_DESTINATIONS);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const backendRes = await fetch(`/api/destinations/search?query=${encodeURIComponent(searchQuery)}`);
        if (backendRes.ok) {
          const data = await backendRes.json();
          if (Array.isArray(data) && data.length > 0) {
            setSuggestions(
              data.map((item: { placeId: string; name: string; address: string }) => ({
                placeId: item.placeId,
                main: item.name,
                sub: item.address || 'Singapore',
              }))
            );
            return;
          }
        }

        if (apiKey) {
          const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
            },
            body: JSON.stringify({
              input: searchQuery,
              includedRegionCodes: ['sg'],
            }),
          });
          const json = await res.json();
          if (json.suggestions && Array.isArray(json.suggestions) && json.suggestions.length > 0) {
            setSuggestions(
              json.suggestions.map((item: { placePrediction?: { placeId?: string; place?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; text?: { text?: string } } }) => ({
                placeId: item.placePrediction?.placeId || item.placePrediction?.place || '',
                main: item.placePrediction?.structuredFormat?.mainText?.text || item.placePrediction?.text?.text || 'Location',
                sub: item.placePrediction?.structuredFormat?.secondaryText?.text || 'Singapore',
              }))
            );
            return;
          }
        }

        const matches = POPULAR_DESTINATIONS.filter((d) =>
          d.main.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSuggestions(matches);
      } catch {
        const matches = POPULAR_DESTINATIONS.filter((d) =>
          d.main.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSuggestions(matches);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, apiKey]);

  // 5. Fetch recommended carparks for a destination
  const fetchNearbyCarparks = async (destLat: number, destLng: number) => {
    setIsLoadingCarparks(true);
    setShowCarparksList(true);
    try {
      const queryParams = new URLSearchParams({
        destinationLat: String(destLat),
        destinationLng: String(destLng),
        sort: pricingAsc ? 'distance' : 'recommended',
      });
      if (evFilter === 'yes') queryParams.append('evChargingOnly', 'true');
      if (shelteredFilter === 'yes') queryParams.append('shelteredOnly', 'true');
      if (availabilityFilter.has('high')) queryParams.append('minAvailability', 'High');
      else if (availabilityFilter.has('moderate')) queryParams.append('minAvailability', 'Moderate');
      else if (availabilityFilter.has('low')) queryParams.append('minAvailability', 'Low');

      const carparkRes = await fetch(`/api/carparks/nearby?${queryParams.toString()}`);
      if (carparkRes.ok) {
        const data = await carparkRes.json();
        const carparks = data.carparks || [];
        if (carparks.length > 0) {
          const cardItems = carparks.map(toCarparkCardData);
          setRecommendedCarparks(cardItems);
          setIsLoadingCarparks(false);
          return;
        }
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: pick curated popular carparks sorted by proximity
    const fallbackItems: CarparkCardData[] = POPULAR_CARPARKS.filter(
      (cp): cp is PlaceItem & { lat: number; lng: number } =>
        typeof cp.lat === 'number' && typeof cp.lng === 'number'
    ).map((cp) => {
      const dist = Math.round(Math.hypot((cp.lat - destLat) * 111000, (cp.lng - destLng) * 111000));
      return {
        carParkNo: cp.placeId || cp.main,
        name: cp.main,
        distanceMeters: dist,
        walkingEtaMinutes: Math.max(1, Math.round(dist / 80)),
        availableLots: cp.availableLots ?? 42,
        totalLots: 120,
        isSheltered: true,
        hasEvCharging: false,
        parkingCost: 0.6,
        carparkType: 'Multi-storey',
        latitude: cp.lat,
        longitude: cp.lng,
      };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);

    setRecommendedCarparks(fallbackItems);
    setIsLoadingCarparks(false);
  };

  // Re-fetch carparks if filters change while carparks list is active
  useEffect(() => {
    let cancelled = false;
    if (showCarparksList && destinationLocation.lat && destinationLocation.lng) {
      const timer = setTimeout(() => {
        if (!cancelled) {
          fetchNearbyCarparks(destinationLocation.lat, destinationLocation.lng);
        }
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evFilter, shelteredFilter, pricingAsc, availabilityFilter, showCarparksList, destinationLocation.lat, destinationLocation.lng]);

  // 6. Handle selecting a destination place
  const handleSelectPlace = async (place: PlaceItem) => {
    // Hide navigation sheet and open carparks list
    setIsSheetVisible(false);
    setShowCarparksList(true);
    setIsLoadingCarparks(true);

    let lat = place.lat;
    let lng = place.lng;
    const name = place.main;

    if ((lat === undefined || lng === undefined) && place.placeId) {
      try {
        const resolveRes = await fetch(`/api/destinations/${encodeURIComponent(place.placeId)}/resolve`);
        if (resolveRes.ok) {
          const resolved = await resolveRes.json();
          if (resolved.latitude && resolved.longitude) {
            lat = resolved.latitude;
            lng = resolved.longitude;
          }
        }
      } catch {
        // Fall through
      }

      if ((lat === undefined || lng === undefined) && apiKey) {
        try {
          const detailRes = await fetch(
            `https://places.googleapis.com/v1/places/${place.placeId}?fields=id,displayName,location&key=${apiKey}`
          );
          const detailData = await detailRes.json();
          if (detailData.location?.latitude && detailData.location?.longitude) {
            lat = detailData.location.latitude;
            lng = detailData.location.longitude;
          }
        } catch {
          // Ignored
        }
      }
    }

    if (lat !== undefined && lng !== undefined) {
      setDestinationLocation({ lat, lng, name });
      await fetchNearbyCarparks(lat, lng);
    } else {
      setIsLoadingCarparks(false);
    }
  };

  // 7. Handle user clicking "Navigate" on a recommended CarparkCard
  const handleNavigateToCarpark = (cp: CarparkCardData) => {
    if (cp.latitude !== undefined && cp.longitude !== undefined) {
      setCarparkLocation({
        lat: cp.latitude,
        lng: cp.longitude,
        name: cp.name,
        availableLots: cp.availableLots,
      });
    }
    setShowCarparksList(false);
    setIsSheetVisible(true);
    setIsSheetCollapsed(false);
  };

  const toggleAvailability = (level: AvailabilityLevel) => {
    setAvailabilityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const clearFilters = () => {
    setPricingAsc(false);
    setEvFilter(null);
    setShelteredFilter(null);
    setAvailabilityFilter(new Set());
  };

  // Cancels active navigation, carparks list & search session
  const handleCancelNavigation = () => {
    setIsSheetVisible(false);
    setShowCarparksList(false);
    setSearchQuery('');
  };

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

      {/* Min's Search Bar with Filter Chips & Autocomplete (Moved up cleanly) */}
      <div className={styles.floatingSearchBarWrapper}>
        <SearchBar
          query={searchQuery}
          onChange={setSearchQuery}
          onSearch={() => {
            if (suggestions.length > 0) {
              handleSelectPlace(suggestions[0]);
            }
          }}
          evFilter={evFilter}
          onEvFilter={setEvFilter}
          shelteredFilter={shelteredFilter}
          onShelteredFilter={setShelteredFilter}
          pricingAsc={pricingAsc}
          onPricingAsc={setPricingAsc}
          availabilityFilter={availabilityFilter}
          onAvailabilityFilter={toggleAvailability}
          onClearFilters={clearFilters}
          placeholder={`Search destination (current: ${destinationLocation.name})`}
          suggestions={suggestions}
          onSelectSuggestion={(place) => {
            handleSelectPlace(place);
          }}
          onGetCurrentLocation={handleGetCurrentLocation}
          isSearching={isSearching}
        />
      </div>

      {/* Full-Bleed Google Maps Canvas */}
      <NavigationMap
        origin={originLocation}
        carpark={carparkLocation}
        destination={destinationLocation}
        drivingPath={isSheetVisible ? activeDrivingRoute?.path : undefined}
        walkingPath={isSheetVisible ? walkingInfo?.path : undefined}
        isLocating={isLocating}
        isSheetCollapsed={isSheetCollapsed}
        isSheetVisible={isSheetVisible}
        showCarparksList={showCarparksList}
        onGetCurrentLocation={handleGetCurrentLocation}
      />

      {/* Recommended Carparks List Panel using CarparkCard component */}
      {showCarparksList && (
        <div className={styles.recommendedCarparksPanel}>
          <div className={styles.sheetHandle} />
          <div className={styles.recommendedCarparksHeader}>
            <div className={styles.recommendedCarparksTitle}>
              <span className={styles.recommendedCarparksCount}>
                {isLoadingCarparks
                  ? 'Finding carparks...'
                  : `${recommendedCarparks.length} carparks near ${destinationLocation.name}`}
              </span>
            </div>
            <button
              className={styles.closeCarparksButton}
              onClick={() => setShowCarparksList(false)}
              aria-label="Close carparks list"
            >
              ✕
            </button>
          </div>

          {isLoadingCarparks ? (
            <div className={styles.recommendedCarparksLoading}>
              <span>Finding recommended carparks near {destinationLocation.name}...</span>
            </div>
          ) : (
            <div className={styles.recommendedCarparksScrollArea}>
              {recommendedCarparks.map((cp, idx) => (
                <CarparkCard
                  key={cp.carParkNo || `${cp.name}-${idx}`}
                  cp={cp}
                  onNavigate={handleNavigateToCarpark}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Navigation Bottom Sheet */}
      {isSheetVisible && (
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
          onCancelNav={handleCancelNavigation}
          weatherInfo={liveWeather}
        />
      )}
    </div>
  );
}

export default NavigationPage;
