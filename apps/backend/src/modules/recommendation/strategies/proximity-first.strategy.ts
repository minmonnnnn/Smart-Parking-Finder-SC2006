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
 * Strategy prioritizing minimum walking distance over availability lot abundance (80% walk, 20% availability).
 * Designed for drivers carrying luggage, families with small children, or those with mobility concerns.
 */
export class ProximityFirstStrategy implements IRankingStrategy {
  readonly strategyName = 'ProximityFirst';

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

    // 80% walking proximity weight, 20% availability weight
    const baseScore = 0.2 * availabilityScore + 0.8 * walkingScore;

    const finalScore =
      rainExpected && isSheltered
        ? Math.min(1, baseScore * SHELTERED_RAIN_SCORE_MULTIPLIER)
        : baseScore;

    return { availabilityScore, walkingScore, baseScore, finalScore };
  }
}

