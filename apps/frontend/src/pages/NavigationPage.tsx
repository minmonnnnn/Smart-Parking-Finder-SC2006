import { useEffect, useState } from 'react';
import styles from './NavigationPage.module.css';

// Feature Components
import { NavigationMap } from '../features/navigation/components/NavigationMap';
import { NavigationBottomSheet } from '../features/navigation/components/NavigationBottomSheet';
import { SearchBar, type AvailabilityLevel, type YesNo } from '../features/search/SearchBar';
import { CarparkCard } from '../features/search/CarparkCard';
import { toCarparkCardData, type CarparkCardData } from '../features/search/carparkCardUtils';
import { CarparkDetailPage } from './CarparkDetailPage';
import { getCarparkDetails } from '../features/search/carparkApi';
import {
  searchDestinations,
  resolveDestination,
  getNearbyCarparks,
} from '../features/search/searchApi';

// Feature Hooks, Constants & Types
import { useNavigationRoutes } from '../features/navigation/hooks/useNavigationRoutes';
import { useWeather } from '../features/navigation/hooks/weather';
import { getGoogleMapsApiKey } from '../lib/googleMaps';
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

export function NavigationPage({
  onBack,
  initialCarparkNo,
  initialCarparkDetails,
  onNavigate,
}: NavigationPageProps) {
  // Navigation Target Coordinates
  const initialCp = initialCarparkDetails
    ? {
        lat: initialCarparkDetails.carpark.latitude,
        lng: initialCarparkDetails.carpark.longitude,
        name: initialCarparkDetails.carpark.address || initialCarparkDetails.carpark.carParkNo,
        availableLots: initialCarparkDetails.availability.availableLots,
      }
    : DEFAULT_CARPARK;

  const [originLocation, setOriginLocation] = useState(SAMPLE_ORIGIN);
  const [carparkLocation, setCarparkLocation] = useState(initialCp);
  const [destinationLocation, setDestinationLocation] = useState<PlaceItem>(
    initialCarparkDetails
      ? {
          placeId: initialCarparkDetails.carpark.carParkNo,
          main: initialCarparkDetails.carpark.address || initialCarparkDetails.carpark.carParkNo,
          sub: 'Carpark Destination',
          lat: initialCarparkDetails.carpark.latitude,
          lng: initialCarparkDetails.carpark.longitude,
        }
      : DEFAULT_DESTINATION
  );

  // UI View States
  const [isLocating, setIsLocating] = useState(false);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [isSheetVisible, setIsSheetVisible] = useState(true);
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  const [, setSearchTarget] = useState<SearchTargetMode>('destination');

  // Recommended Carparks List & Detail View States
  const [recommendedCarparks, setRecommendedCarparks] = useState<CarparkCardData[]>([]);
  const [showCarparksList, setShowCarparksList] = useState(false);
  const [isLoadingCarparks, setIsLoadingCarparks] = useState(false);
  const [selectedDetailCarparkNo, setSelectedDetailCarparkNo] = useState<string | null>(null);

  // Min's Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceItem[]>(POPULAR_DESTINATIONS);
  const [isSearching, setIsSearching] = useState(false);
  const [evFilter, setEvFilter] = useState<YesNo | null>(null);
  const [shelteredFilter, setShelteredFilter] = useState<YesNo | null>(null);
  const [pricingAsc, setPricingAsc] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<Set<AvailabilityLevel>>(new Set());

  const apiKey = getGoogleMapsApiKey();

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

  // 1.5 Load initial carpark if navigated with initialCarparkNo
  useEffect(() => {
    if (initialCarparkNo) {
      let cancelled = false;
      getCarparkDetails(initialCarparkNo)
        .then((d) => {
          if (cancelled) return;
          const cpName = d.carpark.address || d.carpark.carParkNo;
          setCarparkLocation({
            lat: d.carpark.latitude,
            lng: d.carpark.longitude,
            name: cpName,
            availableLots: d.availability.availableLots,
          });
          setDestinationLocation({
            placeId: d.carpark.carParkNo,
            main: cpName,
            sub: 'Carpark Destination',
            lat: d.carpark.latitude,
            lng: d.carpark.longitude,
          });
          setIsSheetVisible(true);
          setShowCarparksList(false);
        })
        .catch((err) => {
          console.warn('Failed to load initial carpark:', err);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [initialCarparkNo]);

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
        try {
          const data = await searchDestinations(searchQuery);
          if (Array.isArray(data) && data.length > 0) {
            setSuggestions(
              data.map((item) => ({
                placeId: item.placeId,
                main: item.name,
                sub: item.address || 'Singapore',
              }))
            );
            return;
          }
        } catch {
          // Fall through to Google Places / popular destinations
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
      const data = await getNearbyCarparks({
        destinationLat: destLat,
        destinationLng: destLng,
        originLat: originLocation.lat,
        originLng: originLocation.lng,
        filters: {
          ...(evFilter === 'yes' ? { evChargingOnly: true } : {}),
          ...(shelteredFilter === 'yes' ? { shelteredOnly: true } : {}),
        },
      });

      const carparks = data.carparks || [];
      if (carparks.length > 0) {
        let cardItems = carparks.map(toCarparkCardData);

        // Path B: Client-side filtering
        if (evFilter === 'no') {
          cardItems = cardItems.filter((cp) => !cp.hasEvCharging);
        }
        if (shelteredFilter === 'no') {
          cardItems = cardItems.filter((cp) => !cp.isSheltered);
        }
        if (availabilityFilter.size > 0) {
          cardItems = cardItems.filter((cp) => {
            const pct = cp.totalLots > 0 ? (cp.availableLots / cp.totalLots) * 100 : 0;
            const level: AvailabilityLevel = pct >= 30 ? 'high' : pct >= 10 ? 'moderate' : 'low';
            return availabilityFilter.has(level);
          });
        }

        // Path B: Client-side sorting
        if (pricingAsc) {
          cardItems.sort((a, b) => (a.parkingCost ?? Infinity) - (b.parkingCost ?? Infinity));
        }

        setRecommendedCarparks(cardItems);
        setIsLoadingCarparks(false);
        return;
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: pick curated popular carparks sorted by proximity
    let fallbackItems: CarparkCardData[] = POPULAR_CARPARKS.filter(
      (cp): cp is PlaceItem & { lat: number; lng: number } =>
        typeof cp.lat === 'number' && typeof cp.lng === 'number'
    ).map((cp, idx) => {
      const dist = Math.round(Math.hypot((cp.lat - destLat) * 111000, (cp.lng - destLng) * 111000));
      return {
        carParkNo: cp.placeId || cp.main,
        name: cp.main,
        distanceMeters: dist,
        walkingEtaMinutes: Math.max(1, Math.round(dist / 80)),
        availableLots: cp.availableLots ?? 42,
        totalLots: 120,
        isSheltered: true,
        hasEvCharging: idx % 2 === 0,
        parkingCost: 0.6,
        carparkType: 'Multi-storey',
        latitude: cp.lat,
        longitude: cp.lng,
      };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);

    if (evFilter === 'yes') {
      fallbackItems = fallbackItems.filter((cp) => cp.hasEvCharging);
    } else if (evFilter === 'no') {
      fallbackItems = fallbackItems.filter((cp) => !cp.hasEvCharging);
    }
    if (shelteredFilter === 'yes') {
      fallbackItems = fallbackItems.filter((cp) => cp.isSheltered);
    } else if (shelteredFilter === 'no') {
      fallbackItems = fallbackItems.filter((cp) => !cp.isSheltered);
    }
    if (availabilityFilter.size > 0) {
      fallbackItems = fallbackItems.filter((cp) => {
        const pct = cp.totalLots > 0 ? (cp.availableLots / cp.totalLots) * 100 : 0;
        const level: AvailabilityLevel = pct >= 30 ? 'high' : pct >= 10 ? 'moderate' : 'low';
        return availabilityFilter.has(level);
      });
    }
    if (pricingAsc) {
      fallbackItems.sort((a, b) => (a.parkingCost ?? Infinity) - (b.parkingCost ?? Infinity));
    }

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
        const resolved = await resolveDestination(place.placeId);
        if (resolved.latitude && resolved.longitude) {
          lat = resolved.latitude;
          lng = resolved.longitude;
        }
      } catch {
        // Fall through to Google Places API fallback
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
    setSelectedDetailCarparkNo(null);
    setSearchQuery('');
  };

  return (
    <div className={styles.phoneFrame}>
      {/* Top Actions Header Bar — positioned strictly ABOVE the map */}
      <header className={styles.topHeaderBar}>
        <button
          type="button"
          className={styles.headerButton}
          onClick={() => setIsSideNavOpen((prev) => !prev)}
          aria-label="Navigation menu"
          aria-expanded={isSideNavOpen}
          title="Navigation menu"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.headerButton}
          onClick={onBack}
          title="More options"
          aria-label="More options"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </header>

      {/* Main Map & Navigation Body strictly below the header */}
      <div className={styles.mapArea}>
        {/* Min's Search Bar with Filter Chips & Autocomplete */}
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
            placeholder={`Search destination (current: ${destinationLocation.main || destinationLocation.name || 'Destination'})`}
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
                    onSelect={(cardData) => {
                      if (cardData.carParkNo) {
                        setSelectedDetailCarparkNo(cardData.carParkNo);
                      }
                    }}
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

      {/* Side Navigation Drawer Overlay */}
      {isSideNavOpen && (
        <div
          className={styles.sideNavOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Side navigation"
          onClick={() => setIsSideNavOpen(false)}
        >
          <div
            className={styles.sideNavDrawer}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sideNavBanner} />
            <div className={styles.sideNavMenu}>
              <button
                type="button"
                className={styles.sideNavItem}
                onClick={() => {
                  setIsSideNavOpen(false);
                  onNavigate?.('favourites');
                }}
              >
                <svg
                  className={styles.sideNavHeartIcon}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span className={styles.sideNavItemLabel}>Favourites</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carpark Detail Page Overlay */}
      {selectedDetailCarparkNo && (
        <CarparkDetailPage
          carParkNo={selectedDetailCarparkNo}
          isOverlay
          initialDetails={(() => {
            const cp = recommendedCarparks.find((c) => c.carParkNo === selectedDetailCarparkNo);
            if (!cp) return undefined;
            return {
              carpark: {
                carParkNo: cp.carParkNo || selectedDetailCarparkNo,
                address: cp.name,
                latitude: cp.latitude ?? 1.352,
                longitude: cp.longitude ?? 103.836,
                carParkType: (cp.carparkType as 'Surface' | 'Basement' | 'Multi-storey' | 'Covered') || 'Multi-storey',
                isSheltered: cp.isSheltered ?? true,
                totalLots: cp.totalLots,
                freeParking: 'SUN & PH FR 7AM-10.30PM',
                nightParking: 'YES',
                hasEvCharging: Boolean(cp.hasEvCharging),
                parkingSystem: 'Electronic',
                postalCode: '579837',
                parkingCost: cp.parkingCost ?? 0.6,
                updatedAt: new Date().toISOString(),
              },
              availability: {
                availableLots: cp.availableLots,
                totalLots: cp.totalLots,
                status: cp.availableLots >= 36 ? 'High' : cp.availableLots >= 12 ? 'Moderate' : 'Low',
                lastUpdated: new Date().toISOString(),
                isStale: false,
              },
            };
          })()}
          onBack={() => setSelectedDetailCarparkNo(null)}
          onNavigate={() => {
            const cp = recommendedCarparks.find(
              (c) => c.carParkNo === selectedDetailCarparkNo
            );
            if (cp) {
              handleNavigateToCarpark(cp);
            } else {
              getCarparkDetails(selectedDetailCarparkNo)
                .then((d) => {
                  setCarparkLocation({
                    lat: d.carpark.latitude,
                    lng: d.carpark.longitude,
                    name: d.carpark.address || d.carpark.carParkNo,
                    availableLots: d.availability.availableLots,
                  });
                  setIsSheetVisible(true);
                  setShowCarparksList(false);
                })
                .catch(() => {
                  setIsSheetVisible(true);
                  setShowCarparksList(false);
                });
            }
            setSelectedDetailCarparkNo(null);
          }}
        />
      )}
    </div>
  );
}

export default NavigationPage;
