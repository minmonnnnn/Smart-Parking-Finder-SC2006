import type {
  RecommendationInput,
  RecommendationResult,
} from "@smart-parking/shared-types";
import type { IRankingStrategy } from "./strategies/ranking-strategy.interface.js";
import { BalancedRankingStrategy } from "./strategies/balanced-ranking.strategy.js";
import { CarparkRankingContext } from "./carpark-ranking.context.js";

export * from "./strategies/index.js";
export { CarparkRankingContext } from "./carpark-ranking.context.js";

const defaultContext = new CarparkRankingContext(new BalancedRankingStrategy());

export const calculateRecommendationScore = (
  input: RecommendationInput,
  strategy?: IRankingStrategy,
): RecommendationResult => {
  if (strategy) {
    return strategy.calculateScore(input);
  }
  return defaultContext.calculateScore(input);
};
