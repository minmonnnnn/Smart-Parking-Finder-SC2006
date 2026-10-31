import type {
  RecommendationInput,
  RecommendationResult,
} from '@smart-parking/shared-types';
import type { IRankingStrategy } from './strategies/ranking-strategy.interface.js';
import {
  BalancedRankingStrategy,
  MAX_ACCEPTABLE_WALKING_DISTANCE_METERS,
  SHELTERED_RAIN_SCORE_MULTIPLIER,
} from './strategies/balanced-ranking.strategy.js';
import { CarparkRankingContext } from './carpark-ranking.context.js';

// Re-export constants and strategy types for backwards compatibility and clean imports
export {
  MAX_ACCEPTABLE_WALKING_DISTANCE_METERS,
  SHELTERED_RAIN_SCORE_MULTIPLIER,
};
export * from './strategies/index.js';
export { CarparkRankingContext } from './carpark-ranking.context.js';

// Singleton context instance using default BalancedRankingStrategy
const defaultContext = new CarparkRankingContext(new BalancedRankingStrategy());

/**
 * Scores availability, walking distance, and the sheltered-rain preference using the Strategy Pattern.
 * Defaults to the balanced FR46–FR49 formula, with support for swappable ranking strategies.
 *
 * @param input Ratios, ETA, walking distance, and weather/shelter information.
 * @param strategy Optional strategy override (defaults to BalancedRankingStrategy).
 * @returns Each score component and the final score.
 * @throws {TypeError} When the real-time availability ratio is null.
 */
export const calculateRecommendationScore = (
  input: RecommendationInput,
  strategy?: IRankingStrategy,
): RecommendationResult => {
  if (strategy) {
    return strategy.calculateScore(input);
  }
  return defaultContext.calculateScore(input);
};
