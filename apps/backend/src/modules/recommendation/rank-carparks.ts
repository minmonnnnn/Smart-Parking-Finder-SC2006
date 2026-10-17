import type {
  AvailabilityInfo,
  Carpark,
  RankedCarpark,
} from '@smart-parking/shared-types';
import { ApiException } from '../../lib/errors/index.js';
import { calculateRecommendationScore } from './recommendation-score.js';

export interface RecommendationCandidate {
  carpark: Carpark;
  distanceMeters: number;
  drivingEtaMinutes: number | null;
  walkingEtaMinutes: number;
  availability: AvailabilityInfo;
  historicalAvailabilityRatio: number | null;
  rainExpected: boolean;
}

const hasValidScoringData = (
  candidate: RecommendationCandidate,
): candidate is RecommendationCandidate & { drivingEtaMinutes: number } => {
  const {
    availability,
    carpark,
    distanceMeters,
    drivingEtaMinutes,
    historicalAvailabilityRatio,
    rainExpected,
    walkingEtaMinutes,
  } = candidate;

  return (
    Number.isFinite(availability?.availableLots) &&
    availability.availableLots >= 0 &&
    Number.isFinite(availability?.totalLots) &&
    availability.totalLots > 0 &&
    Number.isFinite(distanceMeters) &&
    distanceMeters >= 0 &&
    Number.isFinite(walkingEtaMinutes) &&
    walkingEtaMinutes >= 0 &&
    drivingEtaMinutes !== null &&
    Number.isFinite(drivingEtaMinutes) &&
    drivingEtaMinutes >= 0 &&
    Number.isFinite(availability.availableLots / availability.totalLots) &&
    typeof rainExpected === 'boolean' &&
    typeof carpark?.isSheltered === 'boolean' &&
    (historicalAvailabilityRatio === null ||
      (Number.isFinite(historicalAvailabilityRatio) &&
        historicalAvailabilityRatio >= 0))
  );
};

export const rankCarparks = (
  candidates: readonly RecommendationCandidate[],
): RankedCarpark[] => {
  const rankedCandidates = candidates.flatMap((candidate, index) => {
    if (!hasValidScoringData(candidate)) {
      return [];
    }

    const score = calculateRecommendationScore({
      realTimeAvailabilityRatio:
        candidate.availability.availableLots / candidate.availability.totalLots,
      historicalAvailabilityRatio: candidate.historicalAvailabilityRatio,
      etaMinutes: candidate.drivingEtaMinutes,
      walkingDistanceMeters: candidate.distanceMeters,
      rainExpected: candidate.rainExpected,
      isSheltered: candidate.carpark.isSheltered,
    });

    const rankedCarpark: RankedCarpark = {
      carpark: candidate.carpark,
      distanceMeters: candidate.distanceMeters,
      drivingEtaMinutes: candidate.drivingEtaMinutes,
      walkingEtaMinutes: candidate.walkingEtaMinutes,
      availability: candidate.availability,
      recommendationScore: score.finalScore,
    };

    return [{ rankedCarpark, inputIndex: index }];
  });

  rankedCandidates.sort(
    (left, right) =>
      right.rankedCarpark.recommendationScore -
        left.rankedCarpark.recommendationScore ||
      left.inputIndex - right.inputIndex,
  );

  if (rankedCandidates.length === 0) {
    throw new ApiException(
      404,
      'NO_CARPARKS_FOUND',
      'No carparks could be scored for this destination.',
    );
  }

  return rankedCandidates.map(({ rankedCarpark }) => rankedCarpark);
};