/** Data used to score a carpark recommendation. */
export interface RecommendationInput {
  /** Current available-lots / total-lots ratio. Null cannot be scored. */
  realTimeAvailabilityRatio: number | null;
  /** Historical ratio, or null to use the real-time-only fallback. */
  historicalAvailabilityRatio: number | null;
  /** Traffic-aware driving ETA in minutes. */
  etaMinutes: number;
  /** Walking distance to the destination, in metres. */
  walkingDistanceMeters: number;
  /** Whether rain is expected. */
  rainExpected: boolean;
  /** Whether the carpark is sheltered. */
  isSheltered: boolean;
}

/** Scores calculated for one carpark recommendation. */
export interface RecommendationResult {
  /** Combined availability score, or the real-time ratio when history is null. */
  availabilityScore: number;
  /** Walking-distance score, with a lower bound of zero. */
  walkingScore: number;
  /** 0.6 availability + 0.4 walking, before the weather adjustment. */
  baseScore: number;
  /** Final score after any sheltered-rain bonus. */
  finalScore: number;
}
