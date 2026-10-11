// Carpark, availability and ranked-result types.
// Static fields: Moufooza (carparks table). Availability and filters: Xi Fei. Ranked results: Min (orchestrator).
// All timestamps are ISO 8601 strings.

export type CarparkType = 'Surface' | 'Basement' | 'Multi-storey' | 'Covered'

export type ParkingSystem = 'Electronic' | 'Coupon'

/** Static carpark information. Mirrors the `carparks` table in docs/DB_SCHEMA.md. */
export interface Carpark {
  /** HDB identifier, e.g. "AK19" */
  carParkNo: string
  address: string
  latitude: number
  longitude: number
  carParkType: CarparkType
  /**
   * Derived from carParkType when ingesting (Basement, Multi-storey and Covered count as sheltered).
   * Used by the weather bonus (FR49) and the Shelter filter chip.
   */
  isSheltered: boolean
  totalLots: number
  /** Free-text condition, e.g. "SUN & PH FR 7AM-10.30PM", or null when there is no free parking. */
  freeParking: string | null
  /** Free-text, e.g. "YES" or "NO" with conditions */
  nightParking: string
  hasEvCharging: boolean
  parkingSystem: ParkingSystem
  postalCode: string | null
  /** Hourly rate in SGD. null when the rate is unknown. */
  parkingCost: number | null
  updatedAt: string
}

/** FR13 */
export type AvailabilityStatus = 'High' | 'Moderate' | 'Low' | 'Unavailable'

/** Real-time availability. GET /api/carparks/:carParkNo/availability. FR11–FR15 */
export interface AvailabilityInfo {
  availableLots: number
  totalLots: number
  status: AvailabilityStatus
  /** When the data source last reported this carpark */
  lastUpdated: string
  /** True when the cached reading is older than the refresh window (FR14) */
  isStale: boolean
}

/** Filters accepted by GET /api/carparks/nearby. Combined with AND; omitted fields don't filter. FR16–FR20 */
export interface CarparkFilters {
  evChargingOnly?: boolean
  shelteredOnly?: boolean
  /** Maximum hourly rate in SGD */
  maxCost?: number
  minAvailability?: Exclude<AvailabilityStatus, 'Unavailable'>
}

/** 'distance' = nearest first, the default per FR9. 'recommended' = highest recommendationScore first (FR44–FR49). */
export type CarparkSort = 'distance' | 'recommended'

/** Query for GET /api/carparks/nearby. */
export interface NearbyCarparksQuery {
  sort?: CarparkSort
  destinationLat: number
  destinationLng: number
  /** Trip origin. When omitted, driving ETAs are not computed. */
  originLat?: number
  originLng?: number
  // TODO: switch to VehicleType from ./user.js once Teik Fei's user.ts is merged.
  vehicleType?: 'EV' | 'Petrol' | 'Hybrid'
  filters?: CarparkFilters
}

/** One entry in the ranked results list. */
export interface RankedCarpark {
  carpark: Carpark
  /** Walking distance from the carpark to the destination */
  distanceMeters: number
  /** Traffic-aware driving time from the origin. null when no origin was given or routing failed. */
  drivingEtaMinutes: number | null
  walkingEtaMinutes: number
  availability: AvailabilityInfo
  /** finalScore from the recommendation engine, 0–1 (FR44–FR49) */
  recommendationScore: number
}

/** Sub-services the orchestrator calls. Listed in `degradedServices` when one fails (FR43, UC-01.EX.3). */
export type CarparkDataService = 'availability' | 'routing' | 'weather' | 'historical'

/** Response of GET /api/carparks/nearby, ordered by the requested `sort`. FR8–FR10 */
export interface NearbyCarparksResponse {
  carparks: RankedCarpark[]
  /** Services that failed. Results are still returned using fallbacks; the UI shows a partial-data banner. */
  degradedServices: CarparkDataService[]
}

/**
 * Response of GET /api/carparks/:carParkNo, used by the details page. FR10
 * Distance and driving time depend on the trip, so the details page takes them from the RankedCarpark it was opened from.
 */
export interface CarparkDetails {
  carpark: Carpark
  availability: AvailabilityInfo
}
