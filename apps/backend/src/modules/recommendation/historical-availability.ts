import { getHistoricalAvailabilityClient } from './historical-availability-client.js';

interface HistoricalAvailabilityRow {
  recorded_date: string;
  available_lots: number;
  total_lots: number;
}

const isValidHistoricalRow = (
  row: unknown,
): row is HistoricalAvailabilityRow => {
  if (typeof row !== 'object' || row === null) {
    return false;
  }

  const record = row as Record<string, unknown>;

  return (
    typeof record.recorded_date === 'string' &&
    record.recorded_date.length > 0 &&
    typeof record.available_lots === 'number' &&
    Number.isFinite(record.available_lots) &&
    record.available_lots >= 0 &&
    typeof record.total_lots === 'number' &&
    Number.isFinite(record.total_lots) &&
    record.total_lots > 0
  );
};

const averageHistoricalRatios = (rows: readonly unknown[]): number | null => {
  const validRows = rows.filter(isValidHistoricalRow);
  const distinctDates = new Set(validRows.map((row) => row.recorded_date));

  if (distinctDates.size < 4) {
    return null;
  }

  const ratioTotal = validRows.reduce(
    (total, row) => total + row.available_lots / row.total_lots,
    0,
  );

  return ratioTotal / validRows.length;
};

/**
 * Averages valid records for the requested carpark, day, and hour bucket.
 * Invalid rows are ignored, and at least four distinct `recorded_date` values
 * are needed before the average is returned.
 *
 * @param carParkNo Carpark identifier.
 * @param dayOfWeek Stored day index, with Sunday as 0.
 * @param hour Start hour of the one-hour bucket (0–23).
 * @returns Average `available_lots / total_lots`, or null if fewer than four
 *   valid dates are found or the historical query is unavailable.
 */
export const getHistoricalAvailabilityRatio = async (
  carParkNo: string,
  dayOfWeek: number,
  hour: number,
): Promise<number | null> => {
  const client = getHistoricalAvailabilityClient();

  if (!client) {
    return null;
  }

  const timeBucketStart = `${String(hour).padStart(2, '0')}:00:00`;

  try {
    const { data, error } = await client
      .from('carpark_availability_historical')
      .select('recorded_date, available_lots, total_lots')
      .eq('car_park_no', carParkNo)
      .eq('day_of_week', dayOfWeek)
      .eq('time_bucket_start', timeBucketStart);

    if (error || !data) {
      return null;
    }

    return averageHistoricalRatios(data);
  } catch {
    return null;
  }
};