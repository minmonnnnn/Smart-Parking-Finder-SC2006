import { buildAvailabilityInfo, type AvailabilityInfo } from "./service.js";

import { getCachedAvailability } from "./cache.js";

export function getAvailabilityByCarParkNo(
  carParkNo: string,
): AvailabilityInfo | null {
  const item = getCachedAvailability(carParkNo);

  if (!item) {
    return null;
  }

  return buildAvailabilityInfo(
    item.availableLots,
    item.totalLots,
    item.fetchedAt,
  );
}
