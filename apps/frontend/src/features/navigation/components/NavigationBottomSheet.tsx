import styles from '../../../pages/NavigationPage.module.css';
import type { RouteInfo, SearchTargetMode, WalkingInfo } from '../types';
import { RouteAlternativePicker } from './RouteAlternativePicker';

interface NavigationBottomSheetProps {
  origin: { name: string };
  carpark: { name: string };
  destination: { name: string };
  drivingRoutes: RouteInfo[];
  activeRouteIndex: number;
  onSelectRoute: (index: number) => void;
  walkingInfo: WalkingInfo;
  isCalculating: boolean;
  isSheetCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenTargetSearch: (target: SearchTargetMode) => void;
  onCancelNav?: () => void;
}

export function NavigationBottomSheet({
  origin,
  carpark,
  destination,
  drivingRoutes,
  activeRouteIndex,
  onSelectRoute,
  walkingInfo,
  isCalculating,
  isSheetCollapsed,
  onToggleCollapse,
  onOpenTargetSearch,
  onCancelNav,
}: NavigationBottomSheetProps) {
  const currentDriving = drivingRoutes[activeRouteIndex] || drivingRoutes[0];
  const totalDurationMinutes =
    (currentDriving?.durationMinutes || 0) + (walkingInfo?.durationMinutes || 0);

  return (
    <div
      className={`${styles.bottomSheet} ${
        isSheetCollapsed ? styles.sheetCollapsed : ''
      }`}
    >
      {/* Drag handle to toggle collapse */}
      <div
        className={styles.sheetHandle}
        onClick={onToggleCollapse}
        title={
          isSheetCollapsed
            ? 'Expand navigation details'
            : 'Collapse navigation details'
        }
      />

      {/* Sheet Header row: Clickable to toggle */}
      <div
        className={`${styles.sheetHeader} ${
          !isSheetCollapsed ? styles.sheetHeaderExpanded : ''
        }`}
        onClick={onToggleCollapse}
      >
        <div className={styles.totalEta}>
          {isCalculating ? (
            <span className={styles.etaCalculatingText}>Calculating ETA...</span>
          ) : (
            <>
              {totalDurationMinutes}{' '}
              <span className={styles.etaUnit}>mins total</span>
            </>
          )}
        </div>
        <div className={styles.headerRightActions}>
          {currentDriving && (
            <span
              className={`${styles.trafficBadge} ${
                currentDriving.traffic === 'Moderate'
                  ? styles.trafficModerate
                  : currentDriving.traffic === 'Heavy'
                  ? styles.trafficHeavy
                  : styles.trafficLight
              }`}
            >
              {currentDriving.traffic} traffic
            </span>
          )}
          <span className={styles.sheetToggleChevron}>
            {isSheetCollapsed ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded Body: Hidden when collapsed */}
      {!isSheetCollapsed && (
        <>
          <div className={styles.tripDetails}>
            {/* Tappable Origin Row */}
            <div
              className={`${styles.clickableTripRow} ${styles.tripRowOrigin}`}
              onClick={() => onOpenTargetSearch('origin')}
              title="Tap to change Start Location (A)"
            >
              <div>
                📍 <strong>Start (A):</strong> {origin.name}
              </div>
              <span className={styles.changeTag}>Change A</span>
            </div>

            {/* Tappable Carpark Row */}
            <div
              className={styles.clickableTripRow}
              onClick={() => onOpenTargetSearch('carpark')}
              title="Tap to change Carpark (P)"
            >
              <div>
                🚗 <strong>{currentDriving?.durationMinutes || 0} mins</strong> drive ({currentDriving?.distanceKm || 0} km) ➔ <strong>{carpark.name}</strong>
              </div>
              <span className={styles.changeTag}>Change P</span>
            </div>

            {/* Tappable Destination Row */}
            <div
              className={`${styles.clickableTripRow} ${styles.tripRowDest}`}
              onClick={() => onOpenTargetSearch('destination')}
              title="Tap to change Destination (B)"
            >
              <div>
                🚶 <strong>{walkingInfo.durationMinutes} mins</strong> walk ({walkingInfo.distanceMeters >= 1000 ? `${(walkingInfo.distanceMeters / 1000).toFixed(1)} km` : `${walkingInfo.distanceMeters} m`}) ➔ <strong>{destination.name}</strong>
              </div>
              <span className={styles.changeTag}>Change B</span>
            </div>
          </div>

          {/* Alternative Routes Selector (FR34) */}
          <RouteAlternativePicker
            drivingRoutes={drivingRoutes}
            activeRouteIndex={activeRouteIndex}
            onSelectRoute={onSelectRoute}
          />

          {/* User Control & Navigation Actions */}
          <div className={styles.sheetActions}>
            <button
              type="button"
              className={styles.startNavBtn}
              onClick={() =>
                alert(
                  `Starting simulated navigation from ${origin.name} to ${carpark.name} (${currentDriving?.durationMinutes || 0} mins drive) then walking to ${destination.name} (${walkingInfo.durationMinutes} mins walk). Have a safe drive!`
                )
              }
            >
              Start Nav
            </button>
            <button
              type="button"
              onClick={onCancelNav || (() => window.history.back())}
              className={styles.cancelBtn}
            >
              Cancel Nav
            </button>
            <div className={styles.weatherSlot}>
              ⛅ <span>Moufooza's Weather slot</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

