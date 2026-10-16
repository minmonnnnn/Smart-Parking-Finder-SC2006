import styles from '../../../pages/NavigationPage.module.css';
import type { RouteInfo } from '../types';

interface RouteAlternativePickerProps {
  drivingRoutes: RouteInfo[];
  activeRouteIndex: number;
  onSelectRoute: (index: number) => void;
}

export function RouteAlternativePicker({
  drivingRoutes,
  activeRouteIndex,
  onSelectRoute,
}: RouteAlternativePickerProps) {
  return (
    <div className={styles.routeButtonGroup}>
      {drivingRoutes.map((route, idx) => {
        const isActive = idx === activeRouteIndex;
        return (
          <button
            key={route.summary + idx}
            type="button"
            className={`${styles.routeButton} ${isActive ? styles.routeButtonActive : ''}`}
            onClick={() => onSelectRoute(idx)}
          >
            <div className={styles.routeSummaryRow}>
              <span className={styles.routeSummaryTitle}>
                {route.summary || `Route ${idx + 1}`}
              </span>
              <span
                className={`${styles.trafficBadge} ${
                  route.traffic === 'Moderate'
                    ? styles.trafficModerate
                    : route.traffic === 'Heavy'
                    ? styles.trafficHeavy
                    : styles.trafficLight
                }`}
              >
                {route.traffic}
              </span>
            </div>
            <div className={styles.routeMetricsRow}>
              <span className={styles.routeDurationText}>
                {route.durationMinutes} mins
              </span>
              <span className={styles.routeDistanceText}>
                ({route.distanceKm} km)
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

