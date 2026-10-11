import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { replaceAvailabilityCache } from "../cache.js";
import { getAvailabilityByCarParkNo } from "../repository.js";

describe("getAvailabilityByCarParkNo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T02:00:00Z"));
    replaceAvailabilityCache([]);
  });

  afterEach(() => {
    replaceAvailabilityCache([]);
    vi.useRealTimers();
  });

  it("returns availability for a cached carpark", () => {
    const fetchedAt = new Date("2026-10-05T02:00:00Z");

    replaceAvailabilityCache([
      {
        carParkNo: "AK19",
        availableLots: 60,
        totalLots: 100,
        fetchedAt,
      },
    ]);

    expect(getAvailabilityByCarParkNo("AK19")).toEqual({
      availableLots: 60,
      totalLots: 100,
      status: "High",
      lastUpdated: fetchedAt.toISOString(),
      isStale: false,
    });
  });

  it("returns null for an unknown carpark", () => {
    expect(getAvailabilityByCarParkNo("ZZ99")).toBeNull();
  });
});
