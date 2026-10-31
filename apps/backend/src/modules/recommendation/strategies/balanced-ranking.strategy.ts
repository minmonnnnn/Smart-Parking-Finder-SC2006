import type {
  RecommendationInput,
  RecommendationResult,
} from '@smart-parking/shared-types';
import type { IRankingStrategy } from './ranking-strategy.interface.js';

export const MAX_ACCEPTABLE_WALKING_DISTANCE_METERS = 800;
export const SHELTERED_RAIN_SCORE_MULTIPLIER = 1.1;

/**
 * Default balanced strategy adhering to SRS FR46–FR49.
 * Balances real-time and historical availability (60%) with walking distance proximity (40%),
 * applying a 10% bonus for sheltered carparks when rain is forecasted.
 */
export class BalancedRankingStrategy implements IRankingStrategy {
  readonly strategyName = 'Balanced';

  calculateScore(input: RecommendationInput): RecommendationResult {
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
  }
}

