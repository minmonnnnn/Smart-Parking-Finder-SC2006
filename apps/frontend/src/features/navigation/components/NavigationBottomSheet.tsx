import { useRef, useState } from 'react';
import styles from '../../../pages/NavigationPage.module.css';
import type { RouteInfo, SearchTargetMode, WalkingInfo } from '../types';
import type { WeatherInfo } from '@smart-parking/shared-types';

export interface NavigationBottomSheetProps {
  origin?: { name: string };
  carpark: { name: string; availableLots?: number };
  destination?: { name: string };
  drivingRoutes?: RouteInfo[];
  activeRouteIndex?: number;
  onSelectRoute?: (index: number) => void;
  walkingInfo?: WalkingInfo;
  isCalculating?: boolean;
  isSheetCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenTargetSearch?: (target: SearchTargetMode) => void;
  onCancelNav?: () => void;
  weatherAlert?: string;
  weatherInfo?: WeatherInfo | null; // <-- Added prop
}

function extractAreaName(name?: string): string {
  if (!name) return 'Bishan';
  if (name.toLowerCase().includes('bishan')) return 'Bishan';
  const clean = name
    .replace(/(Multi-Storey|Basement|Public|Central|Surface)?\s*Carpark.*$/i, '')
    .replace(/\s+(Park|Plaza|Mall|Reservoir|Campus|Station).*$/i, '')
    .replace(/\s+(II|I|A|B|C|1|2|3)$/i, '')
    .trim();
  return clean || name.split(' ')[0] || 'Bishan';
}

export function NavigationBottomSheet({
  carpark,
  drivingRoutes = [],
  activeRouteIndex = 0,
  walkingInfo,
  isCalculating = false,
  isSheetCollapsed = false,
  onToggleCollapse,
  onCancelNav,
  weatherAlert,
  weatherInfo,
}: NavigationBottomSheetProps) {
  const currentDriving = drivingRoutes[activeRouteIndex] || drivingRoutes[0];
  const carparkName = carpark?.name || 'Bishan Park II';
  const lotsRemaining = carpark?.availableLots ?? 42;
  const areaName = extractAreaName(carparkName);

  // Gesture handling for sliding up and down
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number | null>(null);
  const hasDraggedRef = useRef(false);
  const justDraggedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragStartYRef.current = e.clientY;
    hasDraggedRef.current = false;
    setIsDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignored if unsupported
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const diff = e.clientY - dragStartYRef.current;

    if (Math.abs(diff) > 6) {
      hasDraggedRef.current = true;
    }

    if (isSheetCollapsed) {
      // Collapsed: can drag upwards (negative diff)
      if (diff < 0) {
        setDragOffsetY(diff);
      } else {
        setDragOffsetY(diff * 0.2); // rubber-band downward resistance
      }
    } else {
      // Expanded: can drag downwards (positive diff)
      if (diff > 0) {
        setDragOffsetY(diff);
      } else {
        setDragOffsetY(diff * 0.2); // rubber-band upward resistance
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const diff = e.clientY - dragStartYRef.current;
    dragStartYRef.current = null;
    setIsDragging(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }

    if (hasDraggedRef.current) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 120);

      const THRESHOLD = 35;
      if (!isSheetCollapsed && diff > THRESHOLD) {
        onToggleCollapse?.();
      } else if (isSheetCollapsed && diff < -THRESHOLD) {
        onToggleCollapse?.();
      }
    }

    setDragOffsetY(0);
  };

  const handlePointerCancel = () => {
    dragStartYRef.current = null;
    setIsDragging(false);
    setDragOffsetY(0);
  };

  const handleHeaderClick = () => {
    if (justDraggedRef.current) return;
    onToggleCollapse?.();
  };

  // Format walking distance (e.g. 200m or 1.2 km)
  const walkingDist = walkingInfo?.distanceMeters ?? 200;
  const isDirectCarpark = walkingDist <= 50;
  const formattedWalkDistance = isDirectCarpark
    ? 'At Carpark'
    : walkingDist >= 1000
    ? `${(walkingDist / 1000).toFixed(1)} km`
    : `${walkingDist}m`;

  return (
    <div
      className={`${styles.bottomSheet} ${
        isSheetCollapsed ? styles.sheetCollapsed : ''
      } ${isDragging ? styles.bottomSheetDragging : ''}`}
      style={{
        transform: dragOffsetY !== 0 ? `translateY(${dragOffsetY}px)` : undefined,
      }}
    >
      {/* Draggable Zone (Handle + Header) to slide up and down */}
      <div
        className={styles.dragZone}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Drag handle to slide/toggle collapse */}
        <div
          className={styles.sheetHandle}
          onClick={handleHeaderClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleCollapse?.();
            }
          }}
          aria-label={
            isSheetCollapsed
              ? 'Drag handle to expand'
              : 'Drag handle to collapse'
          }
        />

        {/* Header Row: Carpark Name & Lots Left Badge */}
        <div
          className={styles.sheetHeader}
          onClick={handleHeaderClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleCollapse?.();
            }
          }}
          title={
            isSheetCollapsed
              ? 'Expand navigation details'
              : 'Collapse navigation details'
          }
          aria-label={
            isSheetCollapsed
              ? 'Expand navigation details'
              : 'Collapse navigation details'
          }
        >
          <div className={styles.carparkTitle}>{carparkName}</div>
          <span className={styles.lotsBadge}>{lotsRemaining} LOTS LEFT</span>
        </div>
      </div>

      {!isSheetCollapsed && (
        <>
          {/* Subtle Horizontal Divider */}
          <div className={styles.sheetDivider} />

          {/* Drive & Walk Metric Cards */}
          <div className={styles.metricsGrid}>
            {/* Drive Card */}
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {isCalculating
                  ? '...'
                  : `${currentDriving?.durationMinutes ?? 5} mins`}
              </div>
              <div className={styles.metricLabel}>
                Drive ({currentDriving?.distanceKm ? `${currentDriving.distanceKm} km` : '1.6 km'})
              </div>
            </div>

            {/* Walk Card */}
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {isCalculating
                  ? '...'
                  : isDirectCarpark
                  ? '0 min'
                  : `${walkingInfo?.durationMinutes ?? 2} mins`}
              </div>
              <div className={styles.metricLabel}>
                Walk ({formattedWalkDistance})
              </div>
            </div>
          </div>

          {/* Weather Warning or Fair Weather Banner */}
          {weatherInfo?.rainExpected ? (
            <div className={styles.weatherAlertCard}>
              <svg
                className={styles.weatherAlertIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div className={styles.weatherAlertText}>
                {weatherAlert ||
                  `Bring an umbrella — ${weatherInfo.condition.toLowerCase()} expected around ${areaName}.`}
              </div>
            </div>
          ) : weatherInfo ? (
            <div className={styles.weatherInfoCard}>
              <svg
                className={styles.weatherInfoIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              </svg>
              <div className={styles.weatherInfoText}>
                {weatherInfo.condition} around {areaName} • No rain expected
              </div>
            </div>
          ) : (
            <div className={styles.weatherAlertCard}>
              <svg
                className={styles.weatherAlertIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div className={styles.weatherAlertText}>
                {weatherAlert ||
                  `Bring an umbrella — rain shower expected at 9:35 around ${areaName}.`}
              </div>
            </div>
          )}

          {/* Full-Width Red Cancel Navigation Button */}
          <button
            type="button"
            className={styles.cancelNavButton}
            onClick={onCancelNav || (() => window.history.back())}
          >
            Cancel Navigation
          </button>
        </>
      )}
    </div>
  );
}
