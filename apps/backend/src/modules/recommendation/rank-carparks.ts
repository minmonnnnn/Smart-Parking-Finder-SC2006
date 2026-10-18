import type {
  AvailabilityInfo,
  Carpark,
  RankedCarpark,
} from '@smart-parking/shared-types';
import { ApiException } from '../../lib/errors/index.js';
import { calculateRecommendationScore } from './recommendation-score.js';

/** Carpark data and caller-supplied values needed for scoring. */
export interface RecommendationCandidate {
  /** Carpark details, including whether it is sheltered. */
  carpark: Carpark;
  /** Distance to the destination, in metres. */
  distanceMeters: number;
  /** Traffic-aware driving ETA; candidates with null ETA are excluded. */
  drivingEtaMinutes: number | null;
  /** Walking duration, in minutes. */
  walkingEtaMinutes: number;
  /** Current lot counts used to calculate the real-time ratio. */
  availability: AvailabilityInfo;
  /** Supplied historical ratio; null uses the scorer's real-time fallback. */
  historicalAvailabilityRatio: number | null;
  /** Whether rain is expected, supplied by the caller. */
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

/**
 * Scores candidates and sorts them from highest to lowest score. Invalid
 * candidates, including those with null ETA, are skipped. Ties keep input
 * order. Historical ratios and rain data must be supplied by the caller.
 *
 * @param candidates Carparks and the data needed to score them.
 * @returns Scoreable candidates as RankedCarpark results.
 * @throws {ApiException} With status 404 and code NO_CARPARKS_FOUND if the
 *   input is empty or no candidate can be scored.
 */
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