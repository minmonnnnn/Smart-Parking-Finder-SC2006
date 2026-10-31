import type {
  RecommendationInput,
  RecommendationResult,
} from '@smart-parking/shared-types';

/**
 * Strategy interface defining the contract for carpark recommendation scoring algorithms (SC2006 Strategy Pattern).
 */
export interface IRankingStrategy {
  /** Descriptive identifier of the strategy (e.g. 'Balanced', 'ProximityFirst', 'MaxAvailability'). */
  readonly strategyName: string;

  /**
   * Calculates availability, walking, base, and final recommendation scores for a candidate.
   *
   * @param input Ratios, ETA, walking distance, and weather/shelter information.
   * @returns Each score component and the final score.
   * @throws {TypeError} When the real-time availability ratio is null.
   */
  calculateScore(input: RecommendationInput): RecommendationResult;
}

