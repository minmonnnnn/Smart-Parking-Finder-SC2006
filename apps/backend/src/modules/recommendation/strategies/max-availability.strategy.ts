import type {
  RecommendationInput,
  RecommendationResult,
} from '@smart-parking/shared-types';
import type { IRankingStrategy } from './ranking-strategy.interface.js';
import {
  MAX_ACCEPTABLE_WALKING_DISTANCE_METERS,
  SHELTERED_RAIN_SCORE_MULTIPLIER,
} from './balanced-ranking.strategy.js';

/**
 * Strategy prioritizing maximum parking lot availability (85% availability, 15% walk).
 * Recommended during peak rush hours, festive seasons, or heavily congested commercial zones
 * where securing an available parking lot is the primary concern.
 */
export class MaxAvailabilityStrategy implements IRankingStrategy {
  readonly strategyName = 'MaxAvailability';

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
        : Math.pow(0.5, etaMinutes / 10) * realTimeAvailabilityRatio +
          (1 - Math.pow(0.5, etaMinutes / 10)) * historicalAvailabilityRatio;

    const walkingScore = Math.max(
      0,
      1 - walkingDistanceMeters / MAX_ACCEPTABLE_WALKING_DISTANCE_METERS,
    );

    // 85% availability weight, 15% walking score
    const baseScore = 0.85 * availabilityScore + 0.15 * walkingScore;

    const finalScore =
      rainExpected && isSheltered
        ? Math.min(1, baseScore * SHELTERED_RAIN_SCORE_MULTIPLIER)
        : baseScore;

    return { availabilityScore, walkingScore, baseScore, finalScore };
  }
}

