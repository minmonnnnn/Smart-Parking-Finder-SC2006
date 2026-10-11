import type { AvailabilityStatus } from "./service.js";

export interface CarparkFilterInput {
  carParkNo: string;
  hasEvCharging: boolean;
  parkingCost: number | null;
  availabilityStatus: AvailabilityStatus;
  isSheltered: boolean;
}

export interface CarparkFilters {
  evChargingOnly?: boolean;
  maxCost?: number;
  minAvailability?: "High" | "Moderate" | "Low";
  shelteredOnly?: boolean;
}

const availabilityRank: Record<AvailabilityStatus, number> = {
  Unavailable: 0,
  Low: 1,
  Moderate: 2,
  High: 3,
};

export function filterCarparks(
  carparks: CarparkFilterInput[],
  filters: CarparkFilters,
): CarparkFilterInput[] {
  return carparks.filter((carpark) => {
    if (filters.evChargingOnly && !carpark.hasEvCharging) {
      return false;
    }

    if (filters.shelteredOnly && !carpark.isSheltered) {
      return false;
    }

    if (filters.maxCost !== undefined) {
      if (carpark.parkingCost === null) {
        return false;
      }

      if (carpark.parkingCost > filters.maxCost) {
        return false;
      }
    }

    if (
      filters.minAvailability !== undefined &&
      availabilityRank[carpark.availabilityStatus] <
        availabilityRank[filters.minAvailability]
    ) {
      return false;
    }

    return true;
  });
}
