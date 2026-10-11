export interface RecommendationInput {
  realTimeAvailabilityRatio: number | null;
  historicalAvailabilityRatio: number | null;
  etaMinutes: number;
  walkingDistanceMeters: number;
  rainExpected: boolean;
  isSheltered: boolean;
}

export interface RecommendationResult {
  availabilityScore: number;
  walkingScore: number;
  baseScore: number;
  finalScore: number;
}
