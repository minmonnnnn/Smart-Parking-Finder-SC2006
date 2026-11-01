import type {
  RecommendationInput,
  RecommendationResult,
} from "@smart-parking/shared-types";
import type { IRankingStrategy } from "./strategies/ranking-strategy.interface.js";
import { BalancedRankingStrategy } from "./strategies/balanced-ranking.strategy.js";

export class CarparkRankingContext {
  private strategy: IRankingStrategy;

  constructor(initialStrategy?: IRankingStrategy) {
    this.strategy = initialStrategy ?? new BalancedRankingStrategy();
  }

  setStrategy(strategy: IRankingStrategy): void {
    this.strategy = strategy;
  }

  getStrategy(): IRankingStrategy {
    return this.strategy;
  }

  calculateScore(input: RecommendationInput): RecommendationResult {
    return this.strategy.calculateScore(input);
  }
}
