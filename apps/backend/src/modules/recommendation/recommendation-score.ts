import type {
  RecommendationInput,
  RecommendationResult,
} from '@smart-parking/shared-types';

// Playbook-suggested default; tune this threshold after user testing.
export const MAX_ACCEPTABLE_WALKING_DISTANCE_METERS = 800;

// Interpreted FR49 bonus because the SRS does not specify an exact weather adjustment.
export const SHELTERED_RAIN_SCORE_MULTIPLIER = 1.1;

export const calculateRecommendationScore = (
  input: RecommendationInput,
): RecommendationResult => {
  const {
    realTimeAvailabilityRatio,
    historicalAvailabilityRatio,
    etaMinutes,
    walkingDistanceMeters,
    rainExpected,
    isSheltered,
  } = input;

  if (realTimeAvailabilityRatio === null) {
    throw new TypeError(
      'realTimeAvailabilityRatio is required to calculate a recommendation score',
    );
  }

  const availabilityScore =
    historicalAvailabilityRatio === null
      ? realTimeAvailabilityRatio
      : Math.pow(0.5, etaMinutes / 15) * realTimeAvailabilityRatio +
        (1 - Math.pow(0.5, etaMinutes / 15)) * historicalAvailabilityRatio;
  const walkingScore = Math.max(
    0,
    1 - walkingDistanceMeters / MAX_ACCEPTABLE_WALKING_DISTANCE_METERS,
  );
  const baseScore = 0.6 * availabilityScore + 0.4 * walkingScore;
  const finalScore =
    rainExpected && isSheltered
      ? Math.min(1, baseScore * SHELTERED_RAIN_SCORE_MULTIPLIER)
      : baseScore;

  return { availabilityScore, walkingScore, baseScore, finalScore };
};