import { describe, expect, it } from 'vitest';
import {
  calculateRecommendationScore,
  MAX_ACCEPTABLE_WALKING_DISTANCE_METERS,
} from './recommendation-score.js';

describe('calculateRecommendationScore', () => {
  it('uses only real-time availability at ETA zero and gives zero-distance walking a full score', () => {
    const result = calculateRecommendationScore({
      realTimeAvailabilityRatio: 0.8,
      historicalAvailabilityRatio: 0.4,
      etaMinutes: 0,
      walkingDistanceMeters: 0,
      rainExpected: false,
      isSheltered: false,
    });

    expect(result).toEqual({
      availabilityScore: 0.8,
      walkingScore: 1,
      baseScore: 0.88,
      finalScore: 0.88,
    });
  });

  it('weights real-time and historical availability equally at ETA 15', () => {
    const result = calculateRecommendationScore({
      realTimeAvailabilityRatio: 0.8,
      historicalAvailabilityRatio: 0.4,
      etaMinutes: 15,
      walkingDistanceMeters: 400,
      rainExpected: false,
      isSheltered: false,
    });

    expect(result.availabilityScore).toBeCloseTo(0.6);
    expect(result.walkingScore).toBe(0.5);
    expect(result.baseScore).toBeCloseTo(0.56);
    expect(result.finalScore).toBeCloseTo(0.56);
  });

  it('gives historical availability greater weight at ETA 60 and scores the threshold distance as zero', () => {
    const result = calculateRecommendationScore({
      realTimeAvailabilityRatio: 0.8,
      historicalAvailabilityRatio: 0.4,
      etaMinutes: 60,
      walkingDistanceMeters: MAX_ACCEPTABLE_WALKING_DISTANCE_METERS,
      rainExpected: false,
      isSheltered: false,
    });

    expect(result).toEqual({
      availabilityScore: 0.425,
      walkingScore: 0,
      baseScore: 0.255,
      finalScore: 0.255,
    });
  });

  it('uses the real-time ratio directly when historical availability is unavailable', () => {
    const result = calculateRecommendationScore({
      realTimeAvailabilityRatio: 0.8,
      historicalAvailabilityRatio: null,
      etaMinutes: 60,
      walkingDistanceMeters: MAX_ACCEPTABLE_WALKING_DISTANCE_METERS + 1,
      rainExpected: false,
      isSheltered: false,
    });

    expect(result).toEqual({
      availabilityScore: 0.8,
      walkingScore: 0,
      baseScore: 0.48,
      finalScore: 0.48,
    });
  });

  it('applies the sheltered-rain bonus and caps the final score at one', () => {
    const result = calculateRecommendationScore({
      realTimeAvailabilityRatio: 0.8,
      historicalAvailabilityRatio: 0.4,
      etaMinutes: 15,
      walkingDistanceMeters: 400,
      rainExpected: true,
      isSheltered: true,
    });
    const cappedResult = calculateRecommendationScore({
      realTimeAvailabilityRatio: 1,
      historicalAvailabilityRatio: 1,
      etaMinutes: 15,
      walkingDistanceMeters: 0,
      rainExpected: true,
      isSheltered: true,
    });

    expect(result.baseScore).toBeCloseTo(0.56);
    expect(result.finalScore).toBeCloseTo(0.616);
    expect(cappedResult.finalScore).toBe(1);
  });

  it('does not apply the weather bonus without both rain and shelter', () => {
    const rainButUnsheltered = calculateRecommendationScore({
      realTimeAvailabilityRatio: 0.8,
      historicalAvailabilityRatio: 0.4,
      etaMinutes: 15,
      walkingDistanceMeters: 400,
      rainExpected: true,
      isSheltered: false,
    });
    const shelteredWithoutRain = calculateRecommendationScore({
      realTimeAvailabilityRatio: 0.8,
      historicalAvailabilityRatio: 0.4,
      etaMinutes: 15,
      walkingDistanceMeters: 400,
      rainExpected: false,
      isSheltered: true,
    });

    expect(rainButUnsheltered.finalScore).toBe(0.56);
    expect(shelteredWithoutRain.finalScore).toBe(0.56);
  });

  it('rejects candidates without a real-time availability ratio', () => {
    expect(() =>
      calculateRecommendationScore({
        realTimeAvailabilityRatio: null,
        historicalAvailabilityRatio: 0.4,
        etaMinutes: 15,
        walkingDistanceMeters: 400,
        rainExpected: false,
        isSheltered: false,
      }),
    ).toThrow(
      'realTimeAvailabilityRatio is required to calculate a recommendation score',
    );
  });
});