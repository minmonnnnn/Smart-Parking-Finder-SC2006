import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { vars } from '../../components';
import { CrosshairIcon, MapPinIcon } from '../../components/icons';
import type { PlaceItem } from '../navigation/types';

export type YesNo = 'yes' | 'no';

export interface SearchBarProps {
  query: string;
  onChange: (v: string) => void;
  onSearch?: () => void;
  evFilter: YesNo | null;
  onEvFilter: (v: YesNo | null) => void;
  shelteredFilter: YesNo | null;
  onShelteredFilter: (v: YesNo | null) => void;
  pricingAsc: boolean;
  onPricingAsc: (v: boolean) => void;
  availabilityDesc: boolean;
  onAvailabilityDesc: (v: boolean) => void;
  onClearFilters: () => void;
  placeholder?: string;
  suggestions?: PlaceItem[];
  onSelectSuggestion?: (place: PlaceItem) => void;
  onGetCurrentLocation?: () => void;
  isSearching?: boolean;
  style?: CSSProperties;
}

// Funnel / filter icon (Min's design)
const filterIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="7" y1="12" x2="17" y2="12" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </svg>
);

const chevronDownIcon = (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const searchIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

function DropdownMenu({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: vars.space[1],
        background: vars.color.background,
        border: `1px solid ${vars.color.border}`,
        borderRadius: vars.radius.md,
        boxShadow: '0 4px 12px rgba(17,24,39,0.12)',
        zIndex: 50,
        minWidth: 160,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function DropdownItem({
  children,
  selected,
  onClick,
  multi = false,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: vars.space[2],
        width: '100%',
        padding: `${vars.space[2]} ${vars.space[3]}`,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: vars.fontSize.sm,
        fontFamily: vars.font.family,
        color: vars.color.textPrimary,
        textAlign: 'left',
      }}
    >
      {multi ? (
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            border: `2px solid ${selected ? vars.color.secondary : vars.color.border}`,
            background: selected ? vars.color.secondary : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {selected && (
            <span
              style={{
                color: '#fff',
                fontSize: 10,
                lineHeight: 1,
                fontWeight: 700,
              }}
            >
              ✓
            </span>
          )}
        </span>
      ) : (
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `2px solid ${selected ? vars.color.secondary : vars.color.border}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {selected && (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: vars.color.secondary,
                display: 'block',
              }}
            />
          )}
        </span>
      )}
      {children}
    </button>
  );
}

function FilterPill({
  label,
  active,
  expanded,
  onClick,
}: {
  label: string;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        width: '100%',
        padding: '5px 4px',
        borderRadius: vars.radius.pill,
        border: `1.5px solid ${active || expanded ? vars.color.secondary : vars.color.border}`,
        background: active ? `${vars.color.secondary}18` : vars.color.background,
        color: active || expanded ? vars.color.secondary : vars.color.textSecondary,
        fontSize: '11px',
        fontFamily: vars.font.family,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
      }}
    >
      {label}
      {chevronDownIcon}
    </button>
  );
}

export function SearchBar({
  query,
  onChange,
  onSearch,
  evFilter,
  onEvFilter,
  shelteredFilter,
  onShelteredFilter,
  pricingAsc,
  onPricingAsc,
  availabilityDesc,
  onAvailabilityDesc,
  onClearFilters,
  placeholder = 'Search...',
  suggestions,
  onSelectSuggestion,
  onGetCurrentLocation,
  isSearching = false,
  style,
}: SearchBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  function toggleDropdown(name: string) {
    setOpenDropdown((v) => (v === name ? null : name));
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasSuggestions = Boolean(suggestions && suggestions.length > 0);

  return (
    <div
      ref={containerRef}
      style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: `${vars.space[2]} ${vars.layout.gutter} ${vars.space[3]}`,
        position: 'relative',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Pill input (Min's signature pill design) */}
      <div
        style={{
          width: '92%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          border: `1.5px solid ${vars.color.border}`,
          borderRadius: vars.radius.pill,
          background: vars.color.background,
          boxShadow: '0 2px 10px rgba(17,24,39,0.08)',
          position: 'relative',
        }}
      >
        <span
          style={{
            paddingLeft: vars.space[3],
            display: 'flex',
            alignItems: 'center',
            color: vars.color.textSecondary,
          }}
          aria-hidden="true"
        >
          {searchIcon}
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => e.key === 'Enter' && query.trim() && onSearch?.()}
          placeholder={placeholder}
          aria-label="Destination"
          style={{
            flex: 1,
            padding: `${vars.space[3]} ${vars.space[2]}`,
            border: 'none',
            outline: 'none',
            fontSize: vars.fontSize.md,
            fontFamily: vars.font.family,
            color: vars.color.textPrimary,
            background: 'transparent',
            minWidth: 0,
          }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setShowSuggestions(false);
            }}
            title="Clear search"
            style={{
              background: 'none',
              border: 'none',
              color: vars.color.textMuted,
              cursor: 'pointer',
              padding: `0 ${vars.space[2]}`,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ✕
          </button>
        ) : null}
        <div
          style={{
            width: 1,
            height: 20,
            background: vars.color.border,
            flexShrink: 0,
          }}
        />
        <button
          type="button"
          onClick={() => {
            setFiltersOpen((v) => !v);
            setOpenDropdown(null);
          }}
          aria-label="Toggle filters"
          aria-expanded={filtersOpen}
          style={{
            background: 'none',
            border: 'none',
            padding: `0 ${vars.space[3]}`,
            cursor: 'pointer',
            color: filtersOpen ? vars.color.secondary : vars.color.textSecondary,
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'stretch',
            minWidth: 44,
            justifyContent: 'center',
          }}
        >
          {filterIcon}
        </button>
      </div>

      {/* Suggestion Dropdown */}
      {showSuggestions && hasSuggestions && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% - 6px)',
            left: vars.layout.gutter,
            right: vars.layout.gutter,
            background: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.16)',
            border: `1px solid ${vars.color.border}`,
            maxHeight: '260px',
            overflowY: 'auto',
            zIndex: 60,
            padding: '6px 0',
            textAlign: 'left',
          }}
        >
          {onGetCurrentLocation && (
            <div
              onClick={() => {
                onGetCurrentLocation();
                setShowSuggestions(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                cursor: 'pointer',
                background: '#EFF6FF',
                borderBottom: `1px solid ${vars.color.border}`,
              }}
            >
              <CrosshairIcon size={18} color={vars.color.secondary} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: vars.color.secondary }}>
                  Use My Current Location
                </div>
                <div style={{ fontSize: '11px', color: '#3B82F6' }}>
                  GPS positioning for Start Point
                </div>
              </div>
            </div>
          )}

          {isSearching && (
            <div
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                color: vars.color.textSecondary,
              }}
            >
              Searching places...
            </div>
          )}

          {suggestions?.map((item) => (
            <div
              key={item.placeId || item.main}
              onClick={() => {
                onSelectSuggestion?.(item);
                setShowSuggestions(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #F3F4F6',
              }}
            >
              <MapPinIcon size={18} color={vars.color.textSecondary} style={{ flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: vars.color.textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.main}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: vars.color.textSecondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter chip panel — space-between across full width */}
      {filtersOpen && (
        <div
          style={{
            marginTop: vars.space[2],
            display: 'flex',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <FilterPill
              label="Carpark Pricing"
              active={pricingAsc}
              expanded={openDropdown === 'pricing'}
              onClick={() => toggleDropdown('pricing')}
            />
            {openDropdown === 'pricing' && (
              <DropdownMenu>
                <DropdownItem
                  selected={pricingAsc}
                  onClick={() => {
                    onPricingAsc(!pricingAsc);
                    setOpenDropdown(null);
                  }}
                >
                  Lowest to Highest
                </DropdownItem>
              </DropdownMenu>
            )}
          </div>

          <div style={{ position: 'relative', flex: 1 }}>
            <FilterPill
              label="EV Charger"
              active={evFilter !== null}
              expanded={openDropdown === 'ev'}
              onClick={() => toggleDropdown('ev')}
            />
            {openDropdown === 'ev' && (
              <DropdownMenu>
                <DropdownItem
                  selected={evFilter === 'yes'}
                  onClick={() => {
                    onEvFilter(evFilter === 'yes' ? null : 'yes');
                    setOpenDropdown(null);
                  }}
                >
                  Yes
                </DropdownItem>
                <DropdownItem
                  selected={evFilter === 'no'}
                  onClick={() => {
                    onEvFilter(evFilter === 'no' ? null : 'no');
                    setOpenDropdown(null);
                  }}
                >
                  No
                </DropdownItem>
              </DropdownMenu>
            )}
          </div>

          <div style={{ position: 'relative', flex: 1 }}>
            <FilterPill
              label="Sheltered"
              active={shelteredFilter !== null}
              expanded={openDropdown === 'sheltered'}
              onClick={() => toggleDropdown('sheltered')}
            />
            {openDropdown === 'sheltered' && (
              <DropdownMenu>
                <DropdownItem
                  selected={shelteredFilter === 'yes'}
                  onClick={() => {
                    onShelteredFilter(shelteredFilter === 'yes' ? null : 'yes');
                    setOpenDropdown(null);
                  }}
                >
                  Yes
                </DropdownItem>
                <DropdownItem
                  selected={shelteredFilter === 'no'}
                  onClick={() => {
                    onShelteredFilter(shelteredFilter === 'no' ? null : 'no');
                    setOpenDropdown(null);
                  }}
                >
                  No
                </DropdownItem>
              </DropdownMenu>
            )}
          </div>

          <div style={{ position: 'relative', flex: 1 }}>
            <FilterPill
              label="Availability"
              active={availabilityDesc}
              expanded={openDropdown === 'availability'}
              onClick={() => toggleDropdown('availability')}
            />
            {openDropdown === 'availability' && (
              <DropdownMenu>
                <DropdownItem
                  selected={availabilityDesc}
                  onClick={() => { onAvailabilityDesc(!availabilityDesc); setOpenDropdown(null); }}
                >
                  Highest to Lowest
                </DropdownItem>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* Clear Filters — shown below chips when any filter is active */}
      {filtersOpen &&
        (pricingAsc ||
          evFilter !== null ||
          shelteredFilter !== null ||
          availabilityDesc) && (
          <button
            type="button"
            onClick={() => {
              onClearFilters();
              setOpenDropdown(null);
            }}
            style={{
              display: 'block',
              margin: `${vars.space[1]} 0 0`,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: vars.fontSize.xs,
              color: vars.color.secondary,
              fontFamily: vars.font.family,
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Clear all filters
          </button>
        )}
    </div>
  );
}

