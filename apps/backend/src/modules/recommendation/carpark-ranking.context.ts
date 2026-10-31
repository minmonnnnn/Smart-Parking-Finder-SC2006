import type {
  RecommendationInput,
  RecommendationResult,
} from '@smart-parking/shared-types';
import type { IRankingStrategy } from './strategies/ranking-strategy.interface.js';
import { BalancedRankingStrategy } from './strategies/balanced-ranking.strategy.js';

/**
 * Context class in the Strategy Pattern (SC2006).
 * Maintains a reference to one of the concrete IRankingStrategy objects
 * and delegates score calculation and ranking tasks to the strategy.
 */
export class CarparkRankingContext {
  private strategy: IRankingStrategy;

  constructor(initialStrategy?: IRankingStrategy) {
    this.strategy = initialStrategy ?? new BalancedRankingStrategy();
  }

  /**
   * Replaces the scoring strategy dynamically at runtime.
   */
  setStrategy(strategy: IRankingStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Retrieves the currently active scoring strategy.
   */
  getStrategy(): IRankingStrategy {
    return this.strategy;
  }

  /**
   * Delegates score calculation to the active strategy.
   */
  calculateScore(input: RecommendationInput): RecommendationResult {
    return this.strategy.calculateScore(input);
  }
}

