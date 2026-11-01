import type {
  RecommendationInput,
  RecommendationResult,
} from "@smart-parking/shared-types";

export interface IRankingStrategy {
  readonly strategyName: string;

  calculateScore(input: RecommendationInput): RecommendationResult;
}
