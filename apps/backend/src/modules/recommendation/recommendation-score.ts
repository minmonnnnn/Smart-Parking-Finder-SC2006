import type {
  RecommendationInput,
  RecommendationResult,
} from '@smart-parking/shared-types';

/** Default walking limit in metres; tune this value after user testing. */
export const MAX_ACCEPTABLE_WALKING_DISTANCE_METERS = 800;

/**
 * FR49's weather bonus is unspecified in the SRS, so this uses a 1.1 multiplier
 * for sheltered carparks when rain is expected. The final score is capped at 1.
 */
export const SHELTERED_RAIN_SCORE_MULTIPLIER = 1.1;

/**
 * Scores availability, walking distance, and the sheltered-rain preference.
 * With history, availability is `w * realTime + (1 - w) * historical`, where
 * `w = 0.5 ** (etaMinutes / 15)`. Without history, it uses the real-time ratio
 * directly. The base score is `0.6 * availability + 0.4 * walking`.
 *
 * @param input Ratios, ETA, walking distance, and weather/shelter information.
 * @returns Each score component and the final score.
 * @throws {TypeError} When the real-time availability ratio is null.
 */
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