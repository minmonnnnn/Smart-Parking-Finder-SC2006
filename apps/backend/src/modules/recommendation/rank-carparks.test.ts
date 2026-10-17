import { describe, expect, it } from 'vitest';
import type { AvailabilityInfo, Carpark } from '@smart-parking/shared-types';
import { ApiException } from '../../lib/errors/index.js';
import { rankCarparks, type RecommendationCandidate } from './rank-carparks.js';

const makeCarpark = (carParkNo: string, isSheltered = false): Carpark => ({
  carParkNo,
  address: `${carParkNo} Road`,
  latitude: 1.3,
  longitude: 103.8,
  carParkType: isSheltered ? 'Covered' : 'Surface',
  isSheltered,
  totalLots: 100,
  freeParking: null,
  nightParking: 'NO',
  hasEvCharging: false,
  parkingSystem: 'Electronic',
  postalCode: null,
  parkingCost: null,
  updatedAt: '2026-10-17T00:00:00.000Z',
});

const makeAvailability = (availableLots: number, totalLots = 100): AvailabilityInfo => ({
  availableLots,
  totalLots,
  status: 'Moderate',
  lastUpdated: '2026-10-17T00:00:00.000Z',
  isStale: false,
});

const makeCandidate = (
  carParkNo: string,
  overrides: Partial<RecommendationCandidate> = {},
): RecommendationCandidate => ({
  carpark: makeCarpark(carParkNo),
  distanceMeters: 200,
  drivingEtaMinutes: 15,
  walkingEtaMinutes: 3,
  availability: makeAvailability(80),
  historicalAvailabilityRatio: 0.4,
  rainExpected: false,
  ...overrides,
});

describe('rankCarparks', () => {
  it('returns candidates in descending recommendation score order', () => {
    const highestAvailability = makeCandidate('AK19', {
      availability: makeAvailability(95),
    });
    const shorterWalk = makeCandidate('BK20', { distanceMeters: 50 });

    const ranked = rankCarparks([
      makeCandidate('CK21', { availability: makeAvailability(20), distanceMeters: 700 }),
      highestAvailability,
      shorterWalk,
    ]);

    expect(ranked.map(({ carpark }) => carpark.carParkNo)).toEqual([
      'BK20',
      'AK19',
      'CK21',
    ]);
    expect(ranked[0]?.recommendationScore).toBeGreaterThan(
      ranked[1]?.recommendationScore ?? 0,
    );
  });

  it('excludes candidates with null ETA and ranks scoreable candidates in a mixed list', () => {
    const ranked = rankCarparks([
      makeCandidate('NO-ETA', { drivingEtaMinutes: null }),
      makeCandidate('BAD-LOTS', { availability: makeAvailability(10, 0) }),
      makeCandidate('VALID', { availability: makeAvailability(75) }),
    ]);

    expect(ranked.map(({ carpark }) => carpark.carParkNo)).toEqual(['VALID']);
  });

  it.each([
    {
      field: 'non-finite walking ETA',
      candidate: makeCandidate('BAD-WALK-ETA', { walkingEtaMinutes: Number.NaN }),
    },
    {
      field: 'negative walking ETA',
      candidate: makeCandidate('NEGATIVE-WALK-ETA', { walkingEtaMinutes: -1 }),
    },
    {
      field: 'non-boolean rain expectation',
      candidate: makeCandidate('BAD-RAIN', {
        rainExpected: 'yes' as unknown as boolean,
      }),
    },
    {
      field: 'non-boolean sheltered flag',
      candidate: makeCandidate('BAD-SHELTER', {
        carpark: {
          ...makeCarpark('BAD-SHELTER'),
          isSheltered: 'yes' as unknown as boolean,
        },
      }),
    },
  ])('excludes malformed $field without excluding valid candidates', ({ candidate }) => {
    const ranked = rankCarparks([candidate, makeCandidate('VALID')]);

    expect(ranked.map(({ carpark }) => carpark.carParkNo)).toEqual(['VALID']);
  });

  it('uses the scorer fallback when historical availability is missing', () => {
    const candidate = makeCandidate('AK19', {
      availability: makeAvailability(80),
      historicalAvailabilityRatio: null,
    });

    const [ranked] = rankCarparks([candidate]);

    expect(ranked?.recommendationScore).toBeCloseTo(0.78);
  });

  it('uses sheltered-rain scoring supplied through the candidate input', () => {
    const sheltered = makeCandidate('SHELTERED', {
      carpark: makeCarpark('SHELTERED', true),
      rainExpected: true,
    });
    const unsheltered = makeCandidate('OPEN', {
      rainExpected: true,
    });

    const ranked = rankCarparks([unsheltered, sheltered]);

    expect(ranked[0]?.carpark.carParkNo).toBe('SHELTERED');
    expect(ranked[0]?.recommendationScore).toBeCloseTo(
      (ranked[1]?.recommendationScore ?? 0) * 1.1,
    );
  });

  it('preserves input order when scores are equal', () => {
    const first = makeCandidate('FIRST');
    const second = makeCandidate('SECOND');

    expect(rankCarparks([first, second]).map(({ carpark }) => carpark.carParkNo)).toEqual([
      'FIRST',
      'SECOND',
    ]);
  });

  it('throws NO_CARPARKS_FOUND for empty input', () => {
    try {
      rankCarparks([]);
      throw new Error('Expected rankCarparks to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({
        status: 404,
        code: 'NO_CARPARKS_FOUND',
      });
    }
  });

  it('throws NO_CARPARKS_FOUND when all candidates are unscoreable', () => {
    expect(() =>
      rankCarparks([
        makeCandidate('NO-ETA', { drivingEtaMinutes: null }),
        makeCandidate('NO-LOTS', { availability: makeAvailability(0, 0) }),
      ]),
    ).toThrowError(
      expect.objectContaining({
        status: 404,
        code: 'NO_CARPARKS_FOUND',
      }),
    );
  });

  it('does not reject a ratio above one based on an unsupported availability bound', () => {
    const ranked = rankCarparks([
      makeCandidate('OVER-AVAILABLE', {
        availability: makeAvailability(110, 100),
        historicalAvailabilityRatio: 1.1,
      }),
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.recommendationScore).toBeGreaterThan(0.6);
  });
});