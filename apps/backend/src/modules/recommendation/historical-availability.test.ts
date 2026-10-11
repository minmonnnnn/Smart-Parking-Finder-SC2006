import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getHistoricalAvailabilityClientMock } = vi.hoisted(() => ({
  getHistoricalAvailabilityClientMock: vi.fn(),
}));

vi.mock('./historical-availability-client.js', () => ({
  getHistoricalAvailabilityClient: getHistoricalAvailabilityClientMock,
}));

import { getHistoricalAvailabilityRatio } from './historical-availability.js';

const createQueryMock = (data: unknown, error: unknown = null) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  const from = vi.fn().mockReturnValue(query);

  query.select.mockReturnValue(query);
  query.eq.mockImplementation((column: string) => {
    if (column === 'time_bucket_start') {
      return Promise.resolve({ data, error });
    }

    return query;
  });

  getHistoricalAvailabilityClientMock.mockReturnValue({ from } as never);

  return { from, query };
};

describe('getHistoricalAvailabilityRatio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters by carpark, day, and exact hour bucket, then averages all valid matching records', async () => {
    const { from, query } = createQueryMock([
      { recorded_date: '2025-01-05', available_lots: 5, total_lots: 10 },
      { recorded_date: '2025-01-12', available_lots: 2, total_lots: 4 },
      { recorded_date: '2025-01-19', available_lots: 1, total_lots: 4 },
      { recorded_date: '2025-01-26', available_lots: 3, total_lots: 4 },
      { recorded_date: '2025-01-05', available_lots: 12, total_lots: 10 },
    ]);

    const result = await getHistoricalAvailabilityRatio('AK19', 0, 15);

    expect(result).toBeCloseTo(0.64);
    expect(from).toHaveBeenCalledWith('carpark_availability_historical');
    expect(query.select).toHaveBeenCalledWith(
      'recorded_date, available_lots, total_lots',
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, 'car_park_no', 'AK19');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'day_of_week', 0);
    expect(query.eq).toHaveBeenNthCalledWith(3, 'time_bucket_start', '15:00:00');
  });

  it('returns null when fewer than four distinct valid dates remain', async () => {
    createQueryMock([
      { recorded_date: '2025-01-05', available_lots: 5, total_lots: 10 },
      { recorded_date: '2025-01-05', available_lots: 2, total_lots: 4 },
      { recorded_date: '2025-01-12', available_lots: 1, total_lots: 4 },
      { recorded_date: '2025-01-19', available_lots: 3, total_lots: 4 },
    ]);

    await expect(getHistoricalAvailabilityRatio('AK19', 0, 15)).resolves.toBeNull();
  });

  it('ignores rows with missing or invalid date and lot values before counting distinct days', async () => {
    createQueryMock([
      { recorded_date: '2025-01-05', available_lots: 5, total_lots: 10 },
      { recorded_date: '2025-01-12', available_lots: 2, total_lots: 0 },
      { recorded_date: '2025-01-19', available_lots: null, total_lots: 4 },
      { recorded_date: '2025-01-26', available_lots: 3, total_lots: 4 },
      { recorded_date: '', available_lots: 1, total_lots: 2 },
      { recorded_date: '2025-02-02', available_lots: -1, total_lots: 2 },
      { recorded_date: '2025-02-09', available_lots: 1, total_lots: 2 },
      { recorded_date: '2025-02-16', available_lots: 1, total_lots: 2 },
    ]);

    const result = await getHistoricalAvailabilityRatio('AK19', 0, 15);

    expect(result).toBeCloseTo((0.5 + 0.75 + 0.5 + 0.5) / 4);
  });

  it('returns null when the historical database client is unavailable', async () => {
    getHistoricalAvailabilityClientMock.mockReturnValue(null);

    await expect(getHistoricalAvailabilityRatio('AK19', 0, 15)).resolves.toBeNull();
  });

  it('returns null when the historical query fails', async () => {
    createQueryMock(null, { message: 'historical table unavailable' });

    await expect(getHistoricalAvailabilityRatio('AK19', 0, 15)).resolves.toBeNull();
  });
});