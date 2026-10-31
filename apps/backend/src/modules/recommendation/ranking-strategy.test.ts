import { describe, expect, it } from 'vitest';
import {
  BalancedRankingStrategy,
  ProximityFirstStrategy,
  MaxAvailabilityStrategy,
  CarparkRankingContext,
} from './recommendation-score.js';
import type { RecommendationInput } from '@smart-parking/shared-types';

describe('Recommendation Strategy Pattern', () => {
  const sampleCandidate: RecommendationInput = {
    realTimeAvailabilityRatio: 0.9,
    historicalAvailabilityRatio: 0.5,
    etaMinutes: 10,
    walkingDistanceMeters: 600, // fairly far walk
    rainExpected: false,
    isSheltered: false,
  };

  const closeCandidateWithLowAvailability: RecommendationInput = {
    realTimeAvailabilityRatio: 0.2, // low lots
    historicalAvailabilityRatio: 0.3,
    etaMinutes: 10,
    walkingDistanceMeters: 50, // very close walk
    rainExpected: false,
    isSheltered: false,
  };

  describe('BalancedRankingStrategy', () => {
    it('uses balanced weights (60% availability, 40% walking)', () => {
      const strategy = new BalancedRankingStrategy();
      expect(strategy.strategyName).toBe('Balanced');

      const result = strategy.calculateScore(sampleCandidate);
      expect(result.availabilityScore).toBeGreaterThan(0.7);
      expect(result.walkingScore).toBe(0.25); // 1 - 600/800
      expect(result.baseScore).toBeCloseTo(0.6 * result.availabilityScore + 0.4 * 0.25);
    });
  });

  describe('ProximityFirstStrategy', () => {
    it('ranks closer walking distance higher despite lower availability', () => {
      const balanced = new BalancedRankingStrategy();
      const proximity = new ProximityFirstStrategy();
      expect(proximity.strategyName).toBe('ProximityFirst');

      const balancedFarLots = balanced.calculateScore(sampleCandidate);
      const balancedCloseFewLots = balanced.calculateScore(closeCandidateWithLowAvailability);

      // In balanced, high availability at 600m beats 20% availability at 50m
      expect(balancedFarLots.finalScore).toBeGreaterThan(balancedCloseFewLots.finalScore);

      // In ProximityFirst (80% walking), close distance beats far distance
      const proxFarLots = proximity.calculateScore(sampleCandidate);
      const proxCloseFewLots = proximity.calculateScore(closeCandidateWithLowAvailability);

      expect(proxCloseFewLots.finalScore).toBeGreaterThan(proxFarLots.finalScore);
    });
  });

  describe('MaxAvailabilityStrategy', () => {
    it('heavily prioritizes lot abundance over walking distance during peak periods', () => {
      const strategy = new MaxAvailabilityStrategy();
      expect(strategy.strategyName).toBe('MaxAvailability');

      const farPlentyLots = strategy.calculateScore(sampleCandidate);
      const closeScarceLots = strategy.calculateScore(closeCandidateWithLowAvailability);

      // 85% availability score makes the far carpark win by a wide margin
      expect(farPlentyLots.finalScore).toBeGreaterThan(closeScarceLots.finalScore * 1.5);
    });
  });

  describe('CarparkRankingContext (Runtime strategy switching)', () => {
    it('allows changing strategy dynamically at runtime', () => {
      const context = new CarparkRankingContext(new BalancedRankingStrategy());
      expect(context.getStrategy().strategyName).toBe('Balanced');

      const balancedScore = context.calculateScore(closeCandidateWithLowAvailability);

      // Switch strategy to ProximityFirst
      context.setStrategy(new ProximityFirstStrategy());
      expect(context.getStrategy().strategyName).toBe('ProximityFirst');

      const proximityScore = context.calculateScore(closeCandidateWithLowAvailability);

      // ProximityFirst gives a higher score for short walking distance
      expect(proximityScore.finalScore).toBeGreaterThan(balancedScore.finalScore);

      // Switch strategy to MaxAvailability
      context.setStrategy(new MaxAvailabilityStrategy());
      expect(context.getStrategy().strategyName).toBe('MaxAvailability');

      const maxAvailScore = context.calculateScore(closeCandidateWithLowAvailability);
      // MaxAvailability gives lower score because availability is only 20%
      expect(maxAvailScore.finalScore).toBeLessThan(balancedScore.finalScore);
    });
  });
});

