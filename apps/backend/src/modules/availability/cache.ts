import type { RawAvailabilityRecord } from "./api.js";

const availabilityCache = new Map<string, RawAvailabilityRecord>();

export function replaceAvailabilityCache(
  records: RawAvailabilityRecord[],
): void {
  availabilityCache.clear();

  for (const record of records) {
    availabilityCache.set(record.carParkNo, record);
  }
}

export function getCachedAvailability(
  carParkNo: string,
): RawAvailabilityRecord | null {
  return availabilityCache.get(carParkNo) ?? null;
}
