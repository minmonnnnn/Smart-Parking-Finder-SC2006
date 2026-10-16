import { type ReactNode } from 'react';
import { Card, ProgressBar, progressPercent, vars } from '../../components';
import {
  availabilityTone,
  formatDistance,
  type CarparkCardData,
} from './carparkCardUtils';

export type { CarparkCardData };

export interface CarparkCardProps {
  cp: CarparkCardData;
  onNavigate?: (cp: CarparkCardData) => void;
  onSelect?: (cp: CarparkCardData) => void;
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: vars.fontSize.xs,
        fontWeight: vars.fontWeight.medium,
        color: vars.color.textSecondary,
        background: vars.color.surface,
        border: `1px solid ${vars.color.border}`,
        borderRadius: vars.radius.pill,
        padding: `2px ${vars.space[2]}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

const navigateIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M3 11 22 2l-9 19-2-8-8-2Z" />
  </svg>
);

export function CarparkCard({ cp, onNavigate, onSelect }: CarparkCardProps) {
  const pct = progressPercent(cp.availableLots, cp.totalLots);
  const tone = availabilityTone(Math.round(pct));

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: vars.space[2],
        }}
      >
        <div
          onClick={() => onSelect?.(cp)}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
          onKeyDown={(e) => {
            if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onSelect(cp);
            }
          }}
          style={{
            minWidth: 0,
            flex: 1,
            cursor: onSelect ? 'pointer' : 'default',
          }}
        >
          <div
            style={{
              fontWeight: vars.fontWeight.semibold,
              fontSize: vars.fontSize.md,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: vars.color.textPrimary,
            }}
            title={cp.name}
          >
            {cp.name}
          </div>
          <div
            style={{
              fontSize: vars.fontSize.sm,
              color: vars.color.textSecondary,
              marginTop: vars.space[1],
            }}
          >
            {formatDistance(cp.distanceMeters)} · {cp.walkingEtaMinutes} min walk
          </div>
          <div
            style={{
              display: 'flex',
              gap: vars.space[2],
              marginTop: vars.space[2],
              flexWrap: 'wrap',
            }}
          >
            {cp.isSheltered && <Badge>Sheltered</Badge>}
            {cp.hasEvCharging && <Badge>EV</Badge>}
            {cp.parkingCost !== null && cp.parkingCost !== undefined && (
              <Badge>${cp.parkingCost.toFixed(2)}/hr</Badge>
            )}
            {cp.carparkType && <Badge>{cp.carparkType}</Badge>}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate?.(cp);
          }}
          aria-label={`Navigate to ${cp.name}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: vars.space[1],
            padding: `${vars.space[1]} ${vars.space[2]}`,
            fontSize: vars.fontSize.sm,
            fontFamily: vars.font.family,
            fontWeight: vars.fontWeight.medium,
            background: vars.color.surface,
            color: vars.color.textSecondary,
            border: `1px solid ${vars.color.border}`,
            borderRadius: vars.radius.md,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {navigateIcon} Navigate
        </button>
      </div>

      <hr
        style={{
          border: 0,
          borderTop: `1px solid ${vars.color.border}`,
          margin: `${vars.space[3]} 0`,
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: vars.space[3],
        }}
      >
        <div>
          <span
            style={{
              fontSize: vars.fontSize.xs,
              color: vars.color.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Available lots
          </span>
          <div
            style={{
              fontWeight: vars.fontWeight.bold,
              fontSize: vars.fontSize.lg,
              color:
                tone === 'success'
                  ? vars.color.success
                  : tone === 'warning'
                    ? vars.color.warning
                    : vars.color.danger,
            }}
          >
            {cp.availableLots} / {cp.totalLots}
          </div>
        </div>
        <div style={{ width: 96, textAlign: 'right' }}>
          <div
            style={{
              fontSize: vars.fontSize.xs,
              color: vars.color.textMuted,
              marginBottom: vars.space[1],
            }}
          >
            {Math.round(pct)}% free
          </div>
          <ProgressBar
            value={cp.availableLots}
            max={cp.totalLots}
            label={`${cp.name} availability`}
            tone={tone}
          />
        </div>
      </div>
    </Card>
  );
}
