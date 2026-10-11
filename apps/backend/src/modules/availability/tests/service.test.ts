import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAvailabilityStatus,
  isAvailabilityStale,
  buildAvailabilityInfo,
} from "../service.js";

describe("getAvailabilityStatus", () => {
  it.each([
    [0, 100, "Unavailable"],
    [1, 100, "Low"],
    [9, 100, "Low"],
    [10, 100, "Moderate"],
    [29, 100, "Moderate"],
    [30, 100, "High"],
    [100, 100, "High"],
    [0, 0, "Unavailable"],
    [10, 0, "Unavailable"],
  ] as const)(
    "returns %s/%s lots as %s",
    (availableLots, totalLots, expected) => {
      expect(getAvailabilityStatus(availableLots, totalLots)).toBe(expected);
    },
  );
});

describe("isAvailabilityStale", () => {
  const now = new Date("2026-10-04T00:10:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for data less than three minutes old", () => {
    const fetchedAt = new Date(now.getTime() - 120_000);

    expect(isAvailabilityStale(fetchedAt)).toBe(false);
  });

  it("returns false for data exactly three minutes old", () => {
    const fetchedAt = new Date(now.getTime() - 180_000);

    expect(isAvailabilityStale(fetchedAt)).toBe(false);
  });

  it("returns true immediately after three minutes", () => {
    const fetchedAt = new Date(now.getTime() - 180_001);

    expect(isAvailabilityStale(fetchedAt)).toBe(true);
  });

  it("supports a custom stale threshold", () => {
    const fetchedAt = new Date(now.getTime() - 240_000);

    expect(isAvailabilityStale(fetchedAt, 5)).toBe(false);
    expect(isAvailabilityStale(fetchedAt, 3)).toBe(true);
  });
});

describe("buildAvailabilityInfo", () => {
  const now = new Date("2026-10-04T00:10:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the complete response for fresh data", () => {
    const fetchedAt = new Date("2026-10-04T00:09:00Z");

    expect(buildAvailabilityInfo(60, 100, fetchedAt)).toEqual({
      availableLots: 60,
      totalLots: 100,
      status: "High",
      lastUpdated: fetchedAt.toISOString(),
      isStale: false,
    });
  });

  it("marks old data stale while preserving its lot counts", () => {
    const fetchedAt = new Date("2026-10-04T00:06:00Z");

    expect(buildAvailabilityInfo(20, 100, fetchedAt)).toEqual({
      availableLots: 20,
      totalLots: 100,
      status: "Moderate",
      lastUpdated: fetchedAt.toISOString(),
      isStale: true,
    });
  });
});
