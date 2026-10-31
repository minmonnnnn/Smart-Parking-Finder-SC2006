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
    : null;

  const [originLocation, setOriginLocation] = useState(SAMPLE_ORIGIN);
  const originLocationRef = useRef(originLocation);
  useEffect(() => {
    originLocationRef.current = originLocation;
  }, [originLocation]);
  const simulationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isSimulatingRef = useRef(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedOrigin, setSimulatedOrigin] = useState<typeof SAMPLE_ORIGIN | null>(null);
  const [carparkLocation, setCarparkLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
    availableLots?: number;
  } | null>(initialCp);
  const [destinationLocation, setDestinationLocation] =
    useState<NavDestination | null>(
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
        : null,
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
        if (isSimulatingRef.current) return;
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
    enabled: isSheetVisible,
  });

  const activeDrivingRouteRef = useRef(activeDrivingRoute);
  useEffect(() => {
    activeDrivingRouteRef.current = activeDrivingRoute;
  }, [activeDrivingRoute]);

  const walkingInfoRef = useRef(walkingInfo);
  useEffect(() => {
    walkingInfoRef.current = walkingInfo;
  }, [walkingInfo]);

  const [hasArrived, setHasArrived] = useState(false);
  const [arrivedAtDestination, setArrivedAtDestination] = useState(false);
  const [drivingComplete, setDrivingComplete] = useState(false);
  const [remainingDrivingPath, setRemainingDrivingPath] = useState<{ lat: number; lng: number }[] | null>(null);
  const [remainingWalkingPath, setRemainingWalkingPath] = useState<{ lat: number; lng: number }[] | null>(null);
  const [simulatedRemainingMinutes, setSimulatedRemainingMinutes] = useState<number | null>(null);

  // Console helpers for demo/testing: simulate marker movement along the route
  useEffect(() => {
    function getLatLng(point: { lat: number; lng: number } | google.maps.LatLng) {
      if (typeof (point as google.maps.LatLng).lat === 'function') {
        const p = point as google.maps.LatLng;
        return { lat: p.lat(), lng: p.lng() };
      }
      return point as { lat: number; lng: number };
    }

    function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
      const R = 6371000;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }

    function runPathSimulation(
      path: ({ lat: number; lng: number } | google.maps.LatLng)[],
      speedMs: number,
      onComplete: () => void,
    ) {
      simulationTimeoutsRef.current.forEach(clearTimeout);
      simulationTimeoutsRef.current = [];
      const plainPath = path.map((p) => getLatLng(p as { lat: number; lng: number } | google.maps.LatLng));
      setRemainingDrivingPath(plainPath);

      // Pre-compute cumulative delay for each point
      const delays: number[] = [0];
      for (let i = 0; i < plainPath.length - 1; i++) {
        delays.push(delays[i]! + (haversineMeters(plainPath[i]!, plainPath[i + 1]!) / speedMs) * 1000);
      }
      const totalMs = delays[delays.length - 1]!;

      plainPath.forEach((point, i) => {
        const remainingMs = totalMs - delays[i]!;
        const t = setTimeout(() => {
          setSimulatedOrigin({ lat: point.lat, lng: point.lng, name: 'Simulated Location' });
          setRemainingDrivingPath(plainPath.slice(i));
          setSimulatedRemainingMinutes(Math.max(0, Math.round(remainingMs / 60000)));
          if (i === plainPath.length - 1) {
            setRemainingDrivingPath(null);
            setSimulatedRemainingMinutes(null);
            setIsSimulating(false);
            onComplete();
          }
        }, delays[i]);
        simulationTimeoutsRef.current.push(t);
      });
    }

    (window as unknown as Record<string, unknown>).__startSimulation = (speedKmh = 50) => {
      const path = activeDrivingRouteRef.current?.path;
      if (!path || path.length < 2) {
        console.warn('[Sim] No route path available yet â€” select a destination first');
        return;
      }

      simulationTimeoutsRef.current.forEach(clearTimeout);
      simulationTimeoutsRef.current = [];
      isSimulatingRef.current = true;
      setIsSimulating(true);

      const speedMs = (speedKmh * 1000) / 3600; // m/s

      console.log(`[Sim] Starting simulation: ${path.length} points at ${speedKmh} km/h`);

      runPathSimulation(path, speedMs, () => {
        isSimulatingRef.current = false;
        setSimulatedOrigin(null);
        setDrivingComplete(true);
        setHasArrived(true);
        console.log('[Sim] Arrived at carpark');
      });
    };

    (window as unknown as Record<string, unknown>).__stopSimulation = () => {
      simulationTimeoutsRef.current.forEach(clearTimeout);
      simulationTimeoutsRef.current = [];
      isSimulatingRef.current = false;
      setIsSimulating(false);
      setSimulatedOrigin(null);
      setRemainingDrivingPath(null);
      setRemainingWalkingPath(null);
      setSimulatedRemainingMinutes(null);
      setDrivingComplete(false);
      console.log('[Sim] Simulation stopped');
    };

    return () => {
      simulationTimeoutsRef.current.forEach(clearTimeout);
      delete (window as unknown as Record<string, unknown>).__startSimulation;
      delete (window as unknown as Record<string, unknown>).__stopSimulation;
    };
  }, []);

  //live weather
  const { weather: liveWeather } = useWeather({
    lat: destinationLocation?.lat,
    lng: destinationLocation?.lng,
  });

  // GPS current location as destination (used by SearchBar dropdown)
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
          placeId: "current-location",
          main: name,
          sub: "NTU Campus Demo",
          name,
          lat,
          lng,
        });

        void fetchNearbyCarparks(lat, lng);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      },
    );
  };

  // Updates current device location (Point A) on the map without starting a search (used by floating map button)
  const handleUpdateCurrentLocation = () => {
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

        setOriginLocation({ lat, lng, name });
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

        setOriginLocation({ lat, lng, name });
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      },
    );
  };

  //search suggestions
  useEffect(() => {
    let cancelled = false;

    if (!searchQuery.trim()) {
      setSuggestions(POPULAR_DESTINATIONS);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchDestinations(searchQuery);
        if (!cancelled) {
          if (results.length > 0) {
            setSuggestions(
              results.map((r) => ({
                placeId: r.placeId,
                main: r.name,
                sub: r.address || "Singapore",
                name: r.name,
              }))
            );
          } else {
            const lower = searchQuery.toLowerCase();
            const fallback = POPULAR_DESTINATIONS.filter(
              (p) =>
                p.main.toLowerCase().includes(lower) ||
                p.sub.toLowerCase().includes(lower),
            );
            setSuggestions(fallback);
          }
        }
      } catch (err) {
        console.warn("Autocomplete search failed, using fallback:", err);
        if (!cancelled) {
          const lower = searchQuery.toLowerCase();
          const fallback = POPULAR_DESTINATIONS.filter(
            (p) =>
              p.main.toLowerCase().includes(lower) ||
              p.sub.toLowerCase().includes(lower),
          );
          setSuggestions(fallback);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  //fetch nearby carparks
  const fetchNearbyCarparks = useCallback(
    async (lat?: number, lng?: number) => {
      const destLat = lat ?? destinationLocation?.lat;
      const destLng = lng ?? destinationLocation?.lng;
      if (destLat === undefined || destLng === undefined) return;

      setIsLoadingCarparks(true);

      const filters = {
        evChargingOnly: evFilter === "yes" ? true : undefined,
        shelteredOnly: shelteredFilter === "yes" ? true : undefined,
      };

      try {
        const origin = originLocationRef.current;
        const results = await getNearbyCarparks({
          destinationLat: destLat,
          destinationLng: destLng,
          originLat: origin.lat,
          originLng: origin.lng,
          filters,
        });

        const carparks = results.carparks || [];
        if (carparks.length > 0) {
          let cardItems = carparks.map(toCarparkCardData).filter((cp) => cp.availableLots > 0);

          setRecommendedCarparks(cardItems);
          setIsLoadingCarparks(false);
          return;
        }
      } catch (err) {
        console.warn(
          "Orchestrator nearby search failed, using distance-based fallback:",
          err,
        );
      }

      //fallback to popular carparks
      let fallbackItems: CarparkCardData[] = POPULAR_CARPARKS.filter(
        (cp) => cp.lat !== undefined && cp.lng !== undefined,
      ).map((cp) => {
        const distanceKm = parseFloat(
          calculateDistanceKm(destLat, destLng, cp.lat!, cp.lng!).toFixed(1),
        );
        const walkingMinutes = Math.max(
          1,
          Math.round((distanceKm * 1000) / WALKING_SPEED_M_PER_MIN),
        );

        const isEvMatch = cp.main.toLowerCase().includes("junction 8") || cp.main.toLowerCase().includes("sin ming");
        return {
          carParkNo: cp.placeId || "CP-FALLBACK",
          name: cp.main,
          latitude: cp.lat!,
          longitude: cp.lng!,
          availableLots: cp.availableLots ?? 42,
          totalLots: 120,
          parkingCost: 0.6,
          distanceMeters: Math.round(distanceKm * 1000),
          walkingEtaMinutes: walkingMinutes,
          isSheltered: true,
          hasEvCharging: isEvMatch,
          carparkType: "Multi-storey",
        };
      });

      if (evFilter === "yes") {
        fallbackItems = fallbackItems.filter((cp) => cp.hasEvCharging);
      }
      fallbackItems = fallbackItems.filter((cp) => cp.availableLots > 0);

      fallbackItems.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
      setRecommendedCarparks(fallbackItems);
      setIsLoadingCarparks(false);
    },
    [
      destinationLocation?.lat,
      destinationLocation?.lng,
      evFilter,
      shelteredFilter,
    ],
  );

  //if filtering refetch carparks
  useEffect(() => {
    let cancelled = false;
    const destLat = destinationLocation?.lat;
    const destLng = destinationLocation?.lng;
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
    destinationLocation?.lat,
    destinationLocation?.lng,
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
      setIsSearching(false);
      setIsSheetVisible(false);
      setShowCarparksList(true);
      setIsLoadingCarparks(true);
      setSearchQuery(place.main || place.name || "");

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

  const handleStartWalking = useCallback(() => {
    setHasArrived(false);
    const path = walkingInfoRef.current?.path;
    if (!path || path.length < 2) return;
    const walkingSpeedMs = (200 * 1000) / 3600; // fast for testing
    isSimulatingRef.current = true;
    setIsSimulating(true);

    simulationTimeoutsRef.current.forEach(clearTimeout);
    simulationTimeoutsRef.current = [];

    function getLatLng(point: { lat: number; lng: number } | google.maps.LatLng) {
      if (typeof (point as google.maps.LatLng).lat === 'function') {
        const p = point as google.maps.LatLng;
        return { lat: p.lat(), lng: p.lng() };
      }
      return point as { lat: number; lng: number };
    }

    function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
      const R = 6371000;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }

    const plainPath = path.map((p) => getLatLng(p as { lat: number; lng: number } | google.maps.LatLng));
    setRemainingWalkingPath(plainPath);

    const delays: number[] = [0];
    for (let i = 0; i < plainPath.length - 1; i++) {
      delays.push(delays[i]! + (haversineMeters(plainPath[i]!, plainPath[i + 1]!) / walkingSpeedMs) * 1000);
    }

    plainPath.forEach((point, i) => {
      const t = setTimeout(() => {
        setSimulatedOrigin({ lat: point.lat, lng: point.lng, name: 'Walking' });
        setRemainingWalkingPath(plainPath.slice(i));
        if (i === plainPath.length - 1) {
          isSimulatingRef.current = false;
          setIsSimulating(false);
          setSimulatedOrigin(null);
          setRemainingWalkingPath(null);
          setArrivedAtDestination(true);
          console.log('[Sim] Arrived at destination');
        }
      }, delays[i]);
      simulationTimeoutsRef.current.push(t);
    });
  }, []);

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
    setCarparkLocation(null);
    setDestinationLocation(null);
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
            placeholder={
              destinationLocation
                ? `Search destination (current: ${destinationLocation.main || destinationLocation.name || "Destination"})`
                : "Search destination..."
            }
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
          origin={simulatedOrigin ?? originLocation}
          isSimulating={isSimulating}
          carpark={carparkLocation}
          destination={destinationLocation}
          drivingPath={isSheetVisible && !drivingComplete ? (remainingDrivingPath ?? activeDrivingRoute?.path) : undefined}
          walkingPath={isSheetVisible ? (remainingWalkingPath ?? walkingInfo?.path) : undefined}
          isLocating={isLocating}
          isSheetCollapsed={isSheetCollapsed}
          isSheetVisible={isSheetVisible}
          showCarparksList={showCarparksList}
          onGetCurrentLocation={handleUpdateCurrentLocation}
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
                    : `${recommendedCarparks.length} carparks near ${destinationLocation?.name || "destination"}`}
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
                  Finding recommended carparks near {destinationLocation?.name || "destination"}
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
        {isSheetVisible && carparkLocation && destinationLocation && (
          <NavigationBottomSheet
            origin={originLocation}
            carpark={carparkLocation}
            destination={destinationLocation}
            drivingRoutes={
              isSimulating && simulatedRemainingMinutes !== null
                ? drivingRoutes.map((r, i) =>
                    i === activeRouteIndex
                      ? { ...r, durationMinutes: simulatedRemainingMinutes }
                      : r,
                  )
                : drivingRoutes
            }
            activeRouteIndex={activeRouteIndex}
            onSelectRoute={setActiveRouteIndex}
            walkingInfo={walkingInfo ?? undefined}
            isCalculating={isCalculatingRoute}
            isSheetCollapsed={isSheetCollapsed}
            onToggleCollapse={() => setIsSheetCollapsed((prev) => !prev)}
            onCancelNav={handleCancelNavigation}
            weatherInfo={liveWeather}
          />
        )}
      </div>



      {/*arrived at carpark popup*/}
      {hasArrived && carparkLocation && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 200,
          background: 'rgba(0,0,0,0.45)',
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '28px 24px', margin: '0 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)', textAlign: 'center', width: '100%', maxWidth: 320,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              You have arrived!
            </div>
            <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 4 }}>
              {carparkLocation.name}
            </div>
            {carparkLocation.availableLots !== undefined && (
              <div style={{
                display: 'inline-block', marginBottom: 20, padding: '4px 12px',
                borderRadius: 99, fontSize: 13, fontWeight: 600,
                background: carparkLocation.availableLots >= 20 ? '#D1FAE5' : carparkLocation.availableLots >= 5 ? '#FEF3C7' : '#FEE2E2',
                color: carparkLocation.availableLots >= 20 ? '#065F46' : carparkLocation.availableLots >= 5 ? '#92400E' : '#991B1B',
              }}>
                {carparkLocation.availableLots} lots available
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
              <button
                type="button"
                onClick={handleStartWalking}
                style={{
                  padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: '#F59E0B', color: '#fff', fontWeight: 700, fontSize: 15,
                }}
              >
                Start Walking to Destination
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasArrived(false);
                  simulationTimeoutsRef.current.forEach(clearTimeout);
                  simulationTimeoutsRef.current = [];
                  isSimulatingRef.current = false;
                  setSimulatedOrigin(null);
                }}
                style={{
                  padding: '12px', borderRadius: 12, border: '1.5px solid #E5E7EB',
                  cursor: 'pointer', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 15,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/*arrived at destination popup*/}
      {arrivedAtDestination && destinationLocation && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 200,
          background: 'rgba(0,0,0,0.45)',
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '28px 24px', margin: '0 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)', textAlign: 'center', width: '100%', maxWidth: 320,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              You have arrived!
            </div>
            <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>
              {destinationLocation.name}
            </div>
            <button
              type="button"
              onClick={() => {
                setArrivedAtDestination(false);
                setDrivingComplete(false);
                setRemainingDrivingPath(null);
                setRemainingWalkingPath(null);
                handleCancelNavigation();
              }}
              style={{
                width: '100%', padding: '12px', borderRadius: 12, border: '1.5px solid #E5E7EB',
                cursor: 'pointer', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 15,
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/*Carpark Detail Page overlay*/}
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
                    | "Surface"
                    | "Basement"
                    | "Multi-storey"
                    | "Covered") || "Multi-storey",
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
                  const cpName = d.carpark.address || d.carpark.carParkNo;
                  setCarparkLocation({
                    lat: d.carpark.latitude,
                    lng: d.carpark.longitude,
                    name: cpName,
                    availableLots: d.availability.availableLots,
                  });
                  setDestinationLocation((prev) => prev || {
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
