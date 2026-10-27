import { useEffect, useState } from 'react';
import type { RouteInfo, WalkingInfo } from '../types';
import {
  INITIAL_DRIVING_PATH,
  INITIAL_WALKING_PATH,
  calculateDistanceKm,
} from '../constants';

interface UseNavigationRoutesProps {
  origin: { lat: number; lng: number; name: string };
  carpark: { lat: number; lng: number; name: string };
  destination: { lat: number; lng: number; name: string };
}

// Get driving and walking routes from the api
export function useNavigationRoutes({
  origin,
  carpark,
  destination,
}: UseNavigationRoutesProps) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
  // Placeholder data
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

  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function fetchLiveRoutes() {
      setIsCalculatingRoute(true);

      // Get driving distance
      let calculatedDriveRoutes: RouteInfo[] = [];

      try {
        const driveRes = await fetch(
          `${apiBaseUrl}/routes/driving?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${carpark.lat}&destLng=${carpark.lng}`
        );

        if (driveRes.ok) {
          const driveData = await driveRes.json();
          let pathCoords: google.maps.LatLng[] | { lat: number; lng: number }[] = [
            origin,
            carpark,
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
      } catch {
        // Fall back to direct calculation if backend endpoint is unreachable
      }

      // Fallback if api calls fail
      if (calculatedDriveRoutes.length === 0) {
        const estDist = parseFloat(
          calculateDistanceKm(origin.lat, origin.lng, carpark.lat, carpark.lng).toFixed(1)
        );
        const estDur = Math.max(2, Math.round((estDist / 35) * 60));
        calculatedDriveRoutes = [
          {
            summary: 'Fastest Route',
            durationMinutes: estDur,
            distanceKm: estDist,
            traffic: 'Moderate',
            path: [origin, carpark],
          },
        ];
      }

      // Get walking distance
      let calculatedWalk: WalkingInfo = {
        durationMinutes: 4,
        distanceMeters: 350,
        path: [carpark, destination],
      };

      try {
        const walkRes = await fetch(
          `${apiBaseUrl}/routes/walking?originLat=${carpark.lat}&originLng=${carpark.lng}&destLat=${destination.lat}&destLng=${destination.lng}`
        );

        if (walkRes.ok) {
          const walkData = await walkRes.json();
          let walkCoords: google.maps.LatLng[] | { lat: number; lng: number }[] = [
            carpark,
            destination,
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
      } catch {
        // Fall back to estimation
      }

      if (!isCancelled) {
        setDrivingRoutes(calculatedDriveRoutes);
        setActiveRouteIndex(0);
        setWalkingInfo(calculatedWalk);
        setIsCalculatingRoute(false);
      }
    }

    fetchLiveRoutes();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primitives prevent re-render loops from object identity changes
  }, [
    origin.lat,
    origin.lng,
    carpark.lat,
    carpark.lng,
    destination.lat,
    destination.lng,
    apiBaseUrl,
  ]);

  return {
    drivingRoutes,
    activeRouteIndex,
    setActiveRouteIndex,
    activeDrivingRoute: drivingRoutes[activeRouteIndex] || drivingRoutes[0],
    walkingInfo,
    isCalculatingRoute,
  };
}
