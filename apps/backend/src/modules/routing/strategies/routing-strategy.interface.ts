import type { DrivingRoute, WalkingRoute } from '@smart-parking/shared-types';

export interface RouteCoordinates {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

/**
 * Strategy interface defining the contract for route computation algorithms (SC2006 Strategy Pattern).
 */
export interface IRoutingStrategy {
  /** Descriptive identifier of the strategy (e.g. 'GoogleRoutes', 'GeometricFallback'). */
  readonly strategyName: string;

  /**
   * Calculates a driving route from starting position to destination.
   * @param coords Origin and destination coordinates
   * @returns DrivingRoute object containing polyline, distance, duration, and traffic status
   */
  computeDrivingRoute(coords: RouteCoordinates): Promise<DrivingRoute>;

  /**
   * Calculates a walking route from carpark to destination venue.
   * @param coords Origin and destination coordinates
   * @returns WalkingRoute object containing polyline, distance, and duration
   */
  computeWalkingRoute(coords: RouteCoordinates): Promise<WalkingRoute>;
}

