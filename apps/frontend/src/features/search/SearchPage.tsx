import { type CSSProperties, type ReactNode, useState } from "react";
import { Card, ProgressBar, progressPercent, vars } from "../../components";
import { MapView } from "./MapView";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CarparkType = "Surface" | "Multi-storey" | "Basement";
type YesNo = "yes" | "no";
type AvailabilityLevel = "high" | "moderate" | "low";

function availabilityLevel(
  available: number,
  total: number,
): AvailabilityLevel {
  const pct = progressPercent(available, total);
  return pct >= 30 ? "high" : pct >= 10 ? "moderate" : "low";
}

// ---------------------------------------------------------------------------
// Dummy data — replaced by real API calls in a later slice
// ---------------------------------------------------------------------------
interface DummyCarpark {
  carParkNo: string;
  name: string;
  distanceMeters: number;
  walkingEtaMinutes: number;
  availableLots: number;
  totalLots: number;
  isSheltered: boolean;
  hasEvCharging: boolean;
  parkingCost: number | null;
  carparkType: CarparkType;
}

const DUMMY_CARPARKS: DummyCarpark[] = [
  {
    // availability: high (42/120 = 35%)
    carParkNo: "B20",
    name: "Bishan Park II",
    distanceMeters: 1200,
    walkingEtaMinutes: 14,
    availableLots: 42,
    totalLots: 120,
    isSheltered: false,
    hasEvCharging: false,
    parkingCost: null,
    carparkType: "Surface",
  },
  {
    // availability: moderate (20/120 = 17%)
    carParkNo: "B34",
    name: "Blks 168–180 Bishan St 13",
    distanceMeters: 1500,
    walkingEtaMinutes: 18,
    availableLots: 20,
    totalLots: 120,
    isSheltered: true,
    hasEvCharging: true,
    parkingCost: 0.6,
    carparkType: "Multi-storey",
  },
  {
    // availability: low (8/120 = 7%)
    carParkNo: "B35",
    name: "Blk 135A Bishan Street 12",
    distanceMeters: 1260,
    walkingEtaMinutes: 15,
    availableLots: 8,
    totalLots: 120,
    isSheltered: true,
    hasEvCharging: false,
    parkingCost: 0.5,
    carparkType: "Basement",
  },
  {
    // availability: high (95/120 = 79%) — EV charger, multi-storey = sheltered
    carParkNo: "B22",
    name: "Blk 283 Bishan Street 22",
    distanceMeters: 850,
    walkingEtaMinutes: 10,
    availableLots: 95,
    totalLots: 120,
    isSheltered: true,
    hasEvCharging: true,
    parkingCost: 0.4,
    carparkType: "Multi-storey",
  },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
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

const hamburgerIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const locateIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

// Decreasing horizontal lines (funnel / filter)
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

// ---------------------------------------------------------------------------
// Dropdown primitives
// ---------------------------------------------------------------------------
function DropdownMenu({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: vars.space[1],
        background: vars.color.background,
        border: `1px solid ${vars.color.border}`,
        borderRadius: vars.radius.md,
        boxShadow: "0 4px 12px rgba(17,24,39,0.12)",
        zIndex: 50,
        minWidth: 160,
        overflow: "hidden",
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
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: vars.space[2],
        width: "100%",
        padding: `${vars.space[2]} ${vars.space[3]}`,
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: vars.fontSize.sm,
        fontFamily: vars.font.family,
        color: vars.color.textPrimary,
        textAlign: "left",
      }}
    >
      {multi ? (
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            border: `2px solid ${selected ? vars.color.secondary : vars.color.border}`,
            background: selected ? vars.color.secondary : "transparent",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {selected && (
            <span
              style={{
                color: "#fff",
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
            borderRadius: "50%",
            border: `2px solid ${selected ? vars.color.secondary : vars.color.border}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {selected && (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: vars.color.secondary,
                display: "block",
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
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        width: "100%",
        padding: "5px 4px",
        borderRadius: vars.radius.pill,
        border: `1.5px solid ${active || expanded ? vars.color.secondary : vars.color.border}`,
        background: active
          ? `${vars.color.secondary}18`
          : vars.color.background,
        color:
          active || expanded ? vars.color.secondary : vars.color.textSecondary,
        fontSize: "11px",
        fontFamily: vars.font.family,
        cursor: "pointer",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
      }}
    >
      {label}
      {chevronDownIcon}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Carpark card
// ---------------------------------------------------------------------------
function availabilityTone(pct: number): "success" | "warning" | "danger" {
  if (pct >= 30) return "success";
  if (pct >= 10) return "warning";
  return "danger";
}

function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
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
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function CarparkCard({ cp }: { cp: DummyCarpark }) {
  const pct = progressPercent(cp.availableLots, cp.totalLots);
  const tone = availabilityTone(Math.round(pct));

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: vars.space[2],
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: vars.fontWeight.semibold,
              fontSize: vars.fontSize.md,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: vars.color.textPrimary,
            }}
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
            {formatDistance(cp.distanceMeters)} · {cp.walkingEtaMinutes} min
            walk
          </div>
          <div
            style={{
              display: "flex",
              gap: vars.space[2],
              marginTop: vars.space[2],
              flexWrap: "wrap",
            }}
          >
            {cp.isSheltered && <Badge>Sheltered</Badge>}
            {cp.hasEvCharging && <Badge>EV</Badge>}
            {cp.parkingCost !== null && (
              <Badge>${cp.parkingCost.toFixed(2)}/hr</Badge>
            )}
            <Badge>{cp.carparkType}</Badge>
          </div>
        </div>
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: vars.space[1],
            padding: `${vars.space[1]} ${vars.space[2]}`,
            fontSize: vars.fontSize.sm,
            fontFamily: vars.font.family,
            fontWeight: vars.fontWeight.medium,
            background: vars.color.surface,
            color: vars.color.textSecondary,
            border: `1px solid ${vars.color.border}`,
            borderRadius: vars.radius.md,
            cursor: "pointer",
            whiteSpace: "nowrap",
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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: vars.space[3],
        }}
      >
        <div>
          <span
            style={{
              fontSize: vars.fontSize.xs,
              color: vars.color.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Available lots
          </span>
          <div
            style={{
              fontWeight: vars.fontWeight.bold,
              fontSize: vars.fontSize.lg,
              color:
                tone === "success"
                  ? vars.color.success
                  : tone === "warning"
                    ? vars.color.warning
                    : vars.color.danger,
            }}
          >
            {cp.availableLots} / {cp.totalLots}
          </div>
        </div>
        <div style={{ width: 96, textAlign: "right" }}>
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

// ---------------------------------------------------------------------------
// Search bar (pill input + embedded filter icon + filter chip panel)
// ---------------------------------------------------------------------------
function SearchBar({
  query,
  onChange,
  onSearch,
  evFilter,
  onEvFilter,
  shelteredFilter,
  onShelteredFilter,
  pricingAsc,
  onPricingAsc,
  availabilityFilter,
  onAvailabilityFilter,
  onClearFilters,
}: {
  query: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  evFilter: YesNo | null;
  onEvFilter: (v: YesNo | null) => void;
  shelteredFilter: YesNo | null;
  onShelteredFilter: (v: YesNo | null) => void;
  pricingAsc: boolean;
  onPricingAsc: (v: boolean) => void;
  availabilityFilter: Set<AvailabilityLevel>;
  onAvailabilityFilter: (level: AvailabilityLevel) => void;
  onClearFilters: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  function toggleDropdown(name: string) {
    setOpenDropdown((v) => (v === name ? null : name));
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: `${vars.space[2]} ${vars.layout.gutter} ${vars.space[3]}`,
      }}
    >
      {/* Pill input */}
      <div
        style={{
          width: "90%",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          border: `1.5px solid ${vars.color.border}`,
          borderRadius: vars.radius.pill,
          background: vars.color.background,
          boxShadow: "0 2px 8px rgba(17,24,39,0.08)",
          overflow: "hidden",
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query.trim() && onSearch()}
          placeholder="Search..."
          aria-label="Destination"
          style={{
            flex: 1,
            padding: `${vars.space[3]} 0 ${vars.space[3]} ${vars.space[4]}`,
            border: "none",
            outline: "none",
            fontSize: vars.fontSize.md,
            fontFamily: vars.font.family,
            color: vars.color.textPrimary,
            background: "transparent",
            minWidth: 0,
          }}
        />
        <div
          style={{
            width: 1,
            height: 20,
            background: vars.color.border,
            flexShrink: 0,
          }}
        />
        <button
          onClick={() => {
            setFiltersOpen((v) => !v);
            setOpenDropdown(null);
          }}
          aria-label="Toggle filters"
          aria-expanded={filtersOpen}
          style={{
            background: "none",
            border: "none",
            padding: `0 ${vars.space[3]}`,
            cursor: "pointer",
            color: filtersOpen
              ? vars.color.secondary
              : vars.color.textSecondary,
            display: "flex",
            alignItems: "center",
            alignSelf: "stretch",
            minWidth: 44,
            justifyContent: "center",
          }}
        >
          {filterIcon}
        </button>
      </div>

      {/* Filter chip panel — space-between across full width */}
      {filtersOpen && (
        <div
          style={{
            marginTop: vars.space[2],
            display: "flex",
            justifyContent: "space-between",
            gap: 4,
          }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <FilterPill
              label="Carpark Pricing"
              active={pricingAsc}
              expanded={openDropdown === "pricing"}
              onClick={() => toggleDropdown("pricing")}
            />
            {openDropdown === "pricing" && (
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

          <div style={{ position: "relative", flex: 1 }}>
            <FilterPill
              label="EV Charger"
              active={evFilter !== null}
              expanded={openDropdown === "ev"}
              onClick={() => toggleDropdown("ev")}
            />
            {openDropdown === "ev" && (
              <DropdownMenu>
                <DropdownItem
                  selected={evFilter === "yes"}
                  onClick={() => {
                    onEvFilter(evFilter === "yes" ? null : "yes");
                    setOpenDropdown(null);
                  }}
                >
                  Yes
                </DropdownItem>
                <DropdownItem
                  selected={evFilter === "no"}
                  onClick={() => {
                    onEvFilter(evFilter === "no" ? null : "no");
                    setOpenDropdown(null);
                  }}
                >
                  No
                </DropdownItem>
              </DropdownMenu>
            )}
          </div>

          <div style={{ position: "relative", flex: 1 }}>
            <FilterPill
              label="Sheltered"
              active={shelteredFilter !== null}
              expanded={openDropdown === "sheltered"}
              onClick={() => toggleDropdown("sheltered")}
            />
            {openDropdown === "sheltered" && (
              <DropdownMenu>
                <DropdownItem
                  selected={shelteredFilter === "yes"}
                  onClick={() => {
                    onShelteredFilter(shelteredFilter === "yes" ? null : "yes");
                    setOpenDropdown(null);
                  }}
                >
                  Yes
                </DropdownItem>
                <DropdownItem
                  selected={shelteredFilter === "no"}
                  onClick={() => {
                    onShelteredFilter(shelteredFilter === "no" ? null : "no");
                    setOpenDropdown(null);
                  }}
                >
                  No
                </DropdownItem>
              </DropdownMenu>
            )}
          </div>

          <div style={{ position: "relative", flex: 1 }}>
            <FilterPill
              label="Availability"
              active={availabilityFilter.size > 0}
              expanded={openDropdown === "availability"}
              onClick={() => toggleDropdown("availability")}
            />
            {openDropdown === "availability" && (
              <DropdownMenu>
                {(["high", "moderate", "low"] as AvailabilityLevel[]).map(
                  (level) => (
                    <DropdownItem
                      key={level}
                      selected={availabilityFilter.has(level)}
                      onClick={() => onAvailabilityFilter(level)}
                      multi
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </DropdownItem>
                  ),
                )}
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
          availabilityFilter.size > 0) && (
          <button
            onClick={() => {
              onClearFilters();
              setOpenDropdown(null);
            }}
            style={{
              display: "block",
              margin: `${vars.space[1]} 0 0`,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: vars.fontSize.xs,
              color: vars.color.secondary,
              fontFamily: vars.font.family,
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Clear all filters
          </button>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [destination, setDestination] = useState("");
  const [evFilter, setEvFilter] = useState<YesNo | null>(null);
  const [shelteredFilter, setShelteredFilter] = useState<YesNo | null>(null);
  const [pricingAsc, setPricingAsc] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<
    Set<AvailabilityLevel>
  >(new Set());

  function handleSearch() {
    if (!query.trim()) return;
    setDestination(query.trim());
    setSearched(true);
  }

  function toggleAvailability(level: AvailabilityLevel) {
    setAvailabilityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  function clearFilters() {
    setPricingAsc(false);
    setEvFilter(null);
    setShelteredFilter(null);
    setAvailabilityFilter(new Set());
  }

  const results = DUMMY_CARPARKS.filter(
    (c) =>
      evFilter === null ||
      (evFilter === "yes" ? c.hasEvCharging : !c.hasEvCharging),
  )
    .filter(
      (c) =>
        shelteredFilter === null ||
        (shelteredFilter === "yes" ? c.isSheltered : !c.isSheltered),
    )
    .filter(
      (c) =>
        availabilityFilter.size === 0 ||
        availabilityFilter.has(availabilityLevel(c.availableLots, c.totalLots)),
    )
    .slice()
    .sort((a, b) =>
      pricingAsc
        ? (a.parkingCost ?? Infinity) - (b.parkingCost ?? Infinity)
        : a.distanceMeters - b.distanceMeters,
    );

  const filterProps = {
    evFilter,
    onEvFilter: setEvFilter,
    shelteredFilter,
    onShelteredFilter: setShelteredFilter,
    pricingAsc,
    onPricingAsc: setPricingAsc,
    availabilityFilter,
    onAvailabilityFilter: toggleAvailability,
    onClearFilters: clearFilters,
  };

  const sharedStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: vars.layout.viewportWidth,
    fontFamily: vars.font.family,
    color: vars.color.textPrimary,
    boxSizing: "border-box",
  };

  // ── Home state: no flex, pure position:absolute stacking ──
  if (!searched) {
    return (
      <div style={sharedStyle}>
        <MapView compact={false} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            display: "flex",
            padding: `${vars.space[3]} ${vars.layout.gutter}`,
          }}
        >
          <button
            aria-label="Open menu"
            style={{
              background: "none",
              border: "none",
              padding: vars.space[1],
              cursor: "pointer",
              color: vars.color.background,
            }}
          >
            {hamburgerIcon}
          </button>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        >
          <SearchBar
            query={query}
            onChange={setQuery}
            onSearch={handleSearch}
            {...filterProps}
          />
        </div>
      </div>
    );
  }

  // ── Results state: flex column for compact map + scrollable list ──
  return (
    <div
      style={{
        ...sharedStyle,
        display: "flex",
        flexDirection: "column",
        background: vars.color.background,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          padding: `${vars.space[3]} ${vars.layout.gutter}`,
          flexShrink: 0,
        }}
      >
        <button
          aria-label="Open menu"
          style={{
            background: "none",
            border: "none",
            padding: vars.space[1],
            cursor: "pointer",
            color: vars.color.textPrimary,
          }}
        >
          {hamburgerIcon}
        </button>
      </div>

      {/* Compact map + search bar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <MapView compact />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        >
          <SearchBar
            query={query}
            onChange={setQuery}
            onSearch={handleSearch}
            {...filterProps}
          />
        </div>
      </div>

      {/* Results list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: `0 ${vars.layout.gutter} ${vars.layout.gutter}`,
        }}
      >
        {/* Current Location row */}
        <button
          onClick={() => {}}
          style={{
            display: "flex",
            alignItems: "center",
            gap: vars.space[3],
            width: "100%",
            padding: `${vars.space[3]} 0`,
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            borderBottom: `1px solid ${vars.color.border}`,
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "#dc2626",
            }}
          >
            {locateIcon}
          </span>
          <span>
            <span
              style={{
                display: "block",
                fontWeight: vars.fontWeight.semibold,
                fontSize: vars.fontSize.sm,
                color: vars.color.textPrimary,
              }}
            >
              Current Location
            </span>
            <span
              style={{
                display: "block",
                fontSize: vars.fontSize.xs,
                color: vars.color.textSecondary,
                marginTop: 2,
              }}
            >
              Use current location to find nearby parking
            </span>
          </span>
        </button>

        <div
          style={{
            fontSize: vars.fontSize.sm,
            color: vars.color.textSecondary,
            margin: `${vars.space[2]} 0 ${vars.space[3]}`,
          }}
        >
          {results.length} carparks near {destination}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: vars.space[3],
          }}
        >
          {results.map((cp) => (
            <CarparkCard key={cp.carParkNo} cp={cp} />
          ))}
        </div>
      </div>
    </div>
  );
}
