import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./NavigationPage.module.css";
import { NavigationMap } from "../features/navigation/components/NavigationMap";
import { NavigationBottomSheet } from "../features/navigation/components/NavigationBottomSheet";
import {
  SearchBar,
  type YesNo,
} from "../features/search/SearchBar";
import { CarparkCard } from "../features/search/CarparkCard";
import {
  toCarparkCardData,
  type CarparkCardData,
} from "../features/search/carparkCardUtils";
import { CarparkDetailPage } from "./CarparkDetailPage";
import { getCarparkDetails } from "../features/search/carparkApi";
import {
  searchDestinations,
  resolveDestination,
  getNearbyCarparks,
} from "../features/search/searchApi";
import { useNavigationRoutes } from "../features/navigation/hooks/useNavigationRoutes";
import { calculateDistanceKm, WALKING_SPEED_M_PER_MIN } from "@smart-parking/shared-types";
import { CloseIcon } from "../components/icons";
import { MobileHeader } from "../components/MobileHeader";
import { useWeather } from "../features/navigation/hooks/weather";
import {
  SAMPLE_ORIGIN,
  DEFAULT_CARPARK,
  DEFAULT_DESTINATION,
  POPULAR_DESTINATIONS,
  POPULAR_CARPARKS,
} from "../features/navigation/constants";
import type {
  NavigationPageProps,
  PlaceItem,
  NavDestination,
} from "../features/navigation/types";

export function NavigationPage({
  initialCarparkNo,
  initialCarparkDetails,
  onNavigate,
  onLogout,
  isGuest = false,
}: NavigationPageProps) {
  const initialCp = initialCarparkDetails
    ? {
        lat: initialCarparkDetails.carpark.latitude,
        lng: initialCarparkDetails.carpark.longitude,
        name:
          initialCarparkDetails.carpark.address ||
          initialCarparkDetails.carpark.carParkNo,
        availableLots: initialCarparkDetails.availability.availableLots,
      }
    : DEFAULT_CARPARK;

  const [originLocation, setOriginLocation] = useState(SAMPLE_ORIGIN);
  const originLocationRef = useRef(originLocation);
  useEffect(() => {
    originLocationRef.current = originLocation;
  }, [originLocation]);
  const [carparkLocation, setCarparkLocation] = useState(initialCp);
  const [destinationLocation, setDestinationLocation] =
    useState<NavDestination>(
      initialCarparkDetails
        ? {
            placeId: initialCarparkDetails.carpark.carParkNo,
            main:
              initialCarparkDetails.carpark.address ||
              initialCarparkDetails.carpark.carParkNo,
            sub: "Carpark Destination",
            name:
              initialCarparkDetails.carpark.address ||
              initialCarparkDetails.carpark.carParkNo,
            lat: initialCarparkDetails.carpark.latitude,
            lng: initialCarparkDetails.carpark.longitude,
          }
        : DEFAULT_DESTINATION,
    );

  //maps const
  const [isLocating, setIsLocating] = useState(false);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [isSheetVisible, setIsSheetVisible] = useState(!!initialCarparkDetails);

  //rcommended park const
  const [recommendedCarparks, setRecommendedCarparks] = useState<
    CarparkCardData[]
  >([]);
  const [showCarparksList, setShowCarparksList] = useState(false);
  const [isLoadingCarparks, setIsLoadingCarparks] = useState(false);
  const [selectedDetailCarparkNo, setSelectedDetailCarparkNo] = useState<
    string | null
  >(null);

  //search const
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] =
    useState<PlaceItem[]>(POPULAR_DESTINATIONS);
  const [isSearching, setIsSearching] = useState(false);
  const [evFilter, setEvFilter] = useState<YesNo | null>(null);
  const [shelteredFilter, setShelteredFilter] = useState<YesNo | null>(null);
  const [pricingAsc, setPricingAsc] = useState(false);
  const [availabilityDesc, setAvailabilityDesc] = useState(false);

  // Live watchPosition to continuously update user position and recalculate route as device moves
  useEffect(() => {
    if (!navigator.geolocation || !navigator.geolocation.watchPosition) return;

    let initialAcquired = false;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const rawLat = position.coords.latitude;
        const rawLng = position.coords.longitude;
        const inSingapore =
          rawLat >= 1.15 &&
          rawLat <= 1.48 &&
          rawLng >= 103.55 &&
          rawLng <= 104.05;
        const lat = inSingapore ? rawLat : 1.3483;
        const lng = inSingapore ? rawLng : 103.6831;
        const name = inSingapore
          ? "My Current Location"
          : "Current Location (NTU Campus)";

        setOriginLocation((prev) => {
          // On initial acquisition, always set current GPS location
          if (!initialAcquired) {
            initialAcquired = true;
            return { lat, lng, name };
          }

          // Only trigger route recalculation if device moved more than ~20 meters
          const movedKm = calculateDistanceKm(prev.lat, prev.lng, lat, lng);
          if (movedKm < 0.02) {
            return prev; // Ignore minor GPS jitter
          }

          return { lat, lng, name };
        });
        setIsLocating(false);
      },
      (err) => {
        console.warn("Live GPS watch warning:", err.message);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      },
    );

    return () => {
      if (navigator.geolocation && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

interface NavigationTestWindow {
  __simulateMove?: (meters?: number) => void;
  __setOrigin?: (lat: number, lng: number, name?: string) => void;
}

  // Development test helpers: test location movement directly in the browser console
  useEffect(() => {
    const testWindow = window as unknown as NavigationTestWindow;

    testWindow.__simulateMove = (meters = 100) => {
      setOriginLocation((prev) => {
        const deltaDeg = meters / 111320;
        const next = {
          lat: parseFloat((prev.lat + deltaDeg).toFixed(5)),
          lng: parseFloat((prev.lng + deltaDeg).toFixed(5)),
          name: 'Simulated (+' + meters + 'm)',
        };
        console.log('[Test GPS] Shifted +' + meters + 'm -> (' + next.lat + ', ' + next.lng + ')');
        return next;
      });
    };

    testWindow.__setOrigin = (lat: number, lng: number, name?: string) => {
      console.log('[Test GPS] Setting origin directly to (' + lat + ', ' + lng + ')');
      setOriginLocation({
        lat,
        lng,
        name: name || ('Simulated (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')'),
      });
    };

    return () => {
      delete testWindow.__simulateMove;
      delete testWindow.__setOrigin;
    };
  }, []);

  //load carpark detail based on carparkNo
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
            sub: "Carpark Destination",
            name: cpName,
            lat: d.carpark.latitude,
            lng: d.carpark.longitude,
          });
          setIsSheetVisible(true);
          setShowCarparksList(false);
        })
        .catch((err) => {
          console.warn("Failed to load initial carpark:", err);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [initialCarparkNo]);

  //fetch driving and wallking routes
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

  //live weather
  const { weather: liveWeather } = useWeather({
    lat: destinationLocation.lat,
    lng: destinationLocation.lng,
  });

  //gps current location as destination
  const handleGetCurrentLocation = () => {
    setIsLocating(true);

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawLat = position.coords.latitude;
        const rawLng = position.coords.longitude;
        const inSingapore =
          rawLat >= 1.15 &&
          rawLat <= 1.48 &&
          rawLng >= 103.55 &&
          rawLng <= 104.05;
        const lat = inSingapore ? rawLat : 1.3483;
        const lng = inSingapore ? rawLng : 103.6831;
        const name = inSingapore
          ? "My Current Location"
          : "Current Location (NTU Campus)";

        setIsSheetVisible(false);
        setShowCarparksList(true);
        setIsLoadingCarparks(true);
        setSearchQuery("");

        setDestinationLocation({
          placeId: "current-location",
          main: name,
          sub: inSingapore ? "GPS Location" : "NTU Campus Demo",
          name,
          lat,
          lng,
        });

        void fetchNearbyCarparks(lat, lng);
        setIsLocating(false);
      },
      (error) => {
        console.warn(
          "Geolocation unavailable/blocked, using NTU campus demo location:",
          error.message,
        );
        const lat = 1.3483;
        const lng = 103.6831;
        const name = "Current Location (NTU Campus)";

        setIsSheetVisible(false);
        setShowCarparksList(true);
        setIsLoadingCarparks(true);
        setSearchQuery("");

        setDestinationLocation({
          placeId: "current-location-fallback",
          main: name,
          sub: "NTU Campus Demo",
          name,
          lat,
          lng,
        });

        void fetchNearbyCarparks(lat, lng);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  //live search
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
        let items: PlaceItem[] = [];

        try {
          const data = await searchDestinations(searchQuery);
          if (Array.isArray(data) && data.length > 0) {
            items = data.map((item) => ({
              placeId: item.placeId,
              main: item.name,
              sub: item.address || "Singapore",
              name: item.name,
            }));
          }
        } catch {
          // Fall through to POPULAR_DESTINATIONS fallback
        }

        if (items.length > 0) {
          setSuggestions(items);
        } else {
          const matches = POPULAR_DESTINATIONS.filter((d) =>
            d.main.toLowerCase().includes(searchQuery.toLowerCase()),
          );
          setSuggestions(matches);
        }
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  //get recommended carparks from recommendation
  const fetchNearbyCarparks = useCallback(
    async (destLat: number, destLng: number) => {
      setIsLoadingCarparks(true);
      setShowCarparksList(true);
      try {
        const data = await getNearbyCarparks({
          destinationLat: destLat,
          destinationLng: destLng,
          originLat: originLocationRef.current.lat,
          originLng: originLocationRef.current.lng,
          sort: "recommended",
          filters: {
            ...(evFilter === "yes" ? { evChargingOnly: true } : {}),
            ...(shelteredFilter === "yes" ? { shelteredOnly: true } : {}),
          },
        });

        const carparks = data.carparks || [];
        if (carparks.length > 0) {
          let cardItems = carparks.map(toCarparkCardData).filter((cp) => cp.availableLots > 0);

          if (evFilter === "no") {
            cardItems = cardItems.filter((cp) => !cp.hasEvCharging);
          }
          if (shelteredFilter === "no") {
            cardItems = cardItems.filter((cp) => !cp.isSheltered);
          }
          setRecommendedCarparks(cardItems);
          setIsLoadingCarparks(false);
          return;
        }
      } catch {
        //do nth
      }

      //dummy data fallback
      let fallbackItems: CarparkCardData[] = POPULAR_CARPARKS.filter(
        (cp): cp is PlaceItem & { lat: number; lng: number } =>
          typeof cp.lat === "number" && typeof cp.lng === "number",
      )
        .map((cp, idx): CarparkCardData => {
          const dist = Math.round(
            Math.hypot(
              (cp.lat - destLat) * 111000,
              (cp.lng - destLng) * 111000,
            ),
          );
          return {
            carParkNo: cp.placeId || cp.main,
            name: cp.main,
            distanceMeters: dist,
            walkingEtaMinutes: Math.max(
              1,
              Math.round(dist / WALKING_SPEED_M_PER_MIN),
            ),
            availableLots: cp.availableLots ?? 42,
            totalLots: 120,
            isSheltered: true,
            hasEvCharging: idx % 2 === 0,
            parkingCost: 0.6,
            carparkType: "Multi-storey",
            latitude: cp.lat,
            longitude: cp.lng,
          };
        })
        .sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0) || a.distanceMeters - b.distanceMeters);

      fallbackItems = fallbackItems.filter((cp) => cp.availableLots > 0);

      if (evFilter === "yes") {
        fallbackItems = fallbackItems.filter((cp) => cp.hasEvCharging);
      } else if (evFilter === "no") {
        fallbackItems = fallbackItems.filter((cp) => !cp.hasEvCharging);
      }
      if (shelteredFilter === "yes") {
        fallbackItems = fallbackItems.filter((cp) => cp.isSheltered);
      } else if (shelteredFilter === "no") {
        fallbackItems = fallbackItems.filter((cp) => !cp.isSheltered);
      }
      setRecommendedCarparks(fallbackItems);
      setIsLoadingCarparks(false);
    },
    [evFilter, shelteredFilter],
  );

  //if filtering refetch carparks
  useEffect(() => {
    let cancelled = false;
    const destLat = destinationLocation.lat;
    const destLng = destinationLocation.lng;
    if (showCarparksList && destLat !== undefined && destLng !== undefined) {
      const timer = setTimeout(() => {
        if (!cancelled) {
          fetchNearbyCarparks(destLat, destLng);
        }
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [
    showCarparksList,
    destinationLocation.lat,
    destinationLocation.lng,
    fetchNearbyCarparks,
  ]);

  //select destination
  const handleSelectPlace = async (place: PlaceItem) => {
    let lat = place.lat;
    let lng = place.lng;
    const name = place.main || place.name || "Selected Destination";

    if ((lat === undefined || lng === undefined) && place.placeId) {
      try {
        const resolved = await resolveDestination(place.placeId);
        if (resolved.latitude && resolved.longitude) {
          lat = resolved.latitude;
          lng = resolved.longitude;
        }
      } catch {
        // If backend resolution fails, coordinates remain undefined
      }
    }

    if (lat !== undefined && lng !== undefined) {
      setIsSheetVisible(false);
      setShowCarparksList(true);
      setIsLoadingCarparks(true);

      setDestinationLocation({
        ...place,
        placeId: place.placeId || "dest-selected",
        main: place.main || name,
        sub: place.sub || "Singapore",
        name,
        lat,
        lng,
      });
      await fetchNearbyCarparks(lat, lng);
    }
  };

  //navigate via recommended CarparkCard
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

  const clearFilters = () => {
    setPricingAsc(false);
    setEvFilter(null);
    setShelteredFilter(null);
    setAvailabilityDesc(false);
  };

  const displayCarparks = [...recommendedCarparks].sort((a, b) => {
    if (availabilityDesc) {
      if (b.availableLots !== a.availableLots) return b.availableLots - a.availableLots;
    }
    if (pricingAsc) {
      return (a.parkingCost ?? Infinity) - (b.parkingCost ?? Infinity);
    }
    return 0;
  });

  // Cancels active navigation, carparks list & search session
  const handleCancelNavigation = () => {
    setIsSheetVisible(false);
    setShowCarparksList(false);
    setSelectedDetailCarparkNo(null);
    setSearchQuery("");
  };

  return (
    <div className={styles.phoneFrame}>
      {/*mobile header top nav*/}
      <MobileHeader onNavigate={onNavigate} onLogout={onLogout} isGuest={isGuest} />

      {/*map*/}
      <div className={styles.mapArea}>
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
            availabilityDesc={availabilityDesc}
            onAvailabilityDesc={setAvailabilityDesc}
            onClearFilters={clearFilters}
            placeholder={`Search destination (current: ${destinationLocation.main || destinationLocation.name || "Destination"})`}
            suggestions={suggestions}
            onSelectSuggestion={(place) => {
              handleSelectPlace(place);
            }}
            onGetCurrentLocation={handleGetCurrentLocation}
            isSearching={isSearching}
          />
        </div>

        {/*google maps*/}
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

        {/*carpark list*/}
        {showCarparksList && (
          <div className={styles.recommendedCarparksPanel}>
            <div className={styles.sheetHandle} />
            <div className={styles.recommendedCarparksHeader}>
              <div className={styles.recommendedCarparksTitle}>
                <span className={styles.recommendedCarparksCount}>
                  {isLoadingCarparks
                    ? "Finding carparks..."
                    : `${recommendedCarparks.length} carparks near ${destinationLocation.name}`}
                </span>
              </div>
              <button
                className={styles.closeCarparksButton}
                onClick={() => setShowCarparksList(false)}
                aria-label="Close carparks list"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {isLoadingCarparks ? (
              <div className={styles.recommendedCarparksLoading}>
                <span>
                  Finding recommended carparks near {destinationLocation.name}
                  ...
                </span>
              </div>
            ) : (
              <div className={styles.recommendedCarparksScrollArea}>
                {displayCarparks.map((cp, idx) => (
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

        {/*bottom navigation nav*/}
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
            onCancelNav={handleCancelNavigation}
            weatherInfo={liveWeather}
          />
        )}
      </div>



      {/*carkpark details */}
      {selectedDetailCarparkNo && (
        <CarparkDetailPage
          carParkNo={selectedDetailCarparkNo}
          isOverlay
          initialDetails={(() => {
            const cp = recommendedCarparks.find(
              (c) => c.carParkNo === selectedDetailCarparkNo,
            );
            if (!cp) return undefined;
            return {
              carpark: {
                carParkNo: cp.carParkNo || selectedDetailCarparkNo,
                address: cp.name,
                latitude: cp.latitude ?? 1.352,
                longitude: cp.longitude ?? 103.836,
                carParkType:
                  (cp.carparkType as
                    "Surface" | "Basement" | "Multi-storey" | "Covered") ||
                  "Multi-storey",
                isSheltered: cp.isSheltered ?? true,
                totalLots: cp.totalLots,
                freeParking: "SUN & PH FR 7AM-10.30PM",
                nightParking: "YES",
                hasEvCharging: Boolean(cp.hasEvCharging),
                parkingSystem: "Electronic",
                postalCode: "579837",
                parkingCost: cp.parkingCost ?? 0.6,
                updatedAt: new Date().toISOString(),
              },
              availability: {
                availableLots: cp.availableLots,
                totalLots: cp.totalLots,
                status:
                  cp.availableLots >= 36
                    ? "High"
                    : cp.availableLots >= 12
                      ? "Moderate"
                      : "Low",
                lastUpdated: new Date().toISOString(),
                isStale: false,
              },
            };
          })()}
          onBack={() => setSelectedDetailCarparkNo(null)}
          onNavigate={() => {
            const cp = recommendedCarparks.find(
              (c) => c.carParkNo === selectedDetailCarparkNo,
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
