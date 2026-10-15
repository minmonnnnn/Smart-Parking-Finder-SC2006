import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCarparkAvailability } from "../api.js";
import { checkAvailabilityAlerts } from "../alerts.service.js";
import { getCachedAvailability, replaceAvailabilityCache } from "../cache.js";
import { startAvailabilityPoller } from "../poller.js";
import type { AvailabilityRepository } from "../repository.js";

vi.mock("../api.js", () => ({
  fetchCarparkAvailability: vi.fn(),
}));

vi.mock("../alerts.service.js", () => ({
  checkAvailabilityAlerts: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

const record = {
  carParkNo: "AK19",
  availableLots: 60,
  totalLots: 100,
  fetchedAt: new Date("2026-10-15T02:00:00.000Z"),
};

const saveAvailabilityRecords =
  vi.fn<AvailabilityRepository["saveAvailabilityRecords"]>();

describe("availability poller persistence", () => {
  let stopPoller: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    replaceAvailabilityCache([]);

    vi.mocked(fetchCarparkAvailability).mockResolvedValue([record]);
    vi.mocked(checkAvailabilityAlerts).mockResolvedValue(undefined);
    saveAvailabilityRecords.mockResolvedValue({ saved: 1, skipped: 0 });

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    stopPoller?.();
    stopPoller = undefined;

    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();

    replaceAvailabilityCache([]);
  });

  it("saves fetched records before publishing availability", async () => {
    const sender = vi.fn().mockResolvedValue(undefined);

    stopPoller = startAvailabilityPoller(sender, undefined, {
      saveAvailabilityRecords,
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(saveAvailabilityRecords).toHaveBeenCalledWith([record]);
    expect(getCachedAvailability("AK19")).toEqual(record);
    expect(checkAvailabilityAlerts).toHaveBeenCalledWith(sender);
  });

  it("keeps the local cache after a write failure and retries next minute", async () => {
    const previousRecord = { ...record, availableLots: 1 };
    replaceAvailabilityCache([previousRecord]);

    saveAvailabilityRecords.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );

    stopPoller = startAvailabilityPoller(
      vi.fn().mockResolvedValue(undefined),
      undefined,
      { saveAvailabilityRecords },
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(getCachedAvailability("AK19")).toEqual(previousRecord);
    expect(checkAvailabilityAlerts).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(saveAvailabilityRecords).toHaveBeenCalledTimes(2);
    expect(getCachedAvailability("AK19")).toEqual(record);
    expect(checkAvailabilityAlerts).toHaveBeenCalledTimes(1);
  });

  it("does not overlap refreshes while a database write is pending", async () => {
    const pending = deferred<{ saved: number; skipped: number }>();
    saveAvailabilityRecords.mockReturnValueOnce(pending.promise);

    stopPoller = startAvailabilityPoller(
      vi.fn().mockResolvedValue(undefined),
      undefined,
      { saveAvailabilityRecords },
    );

    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);
    expect(getCachedAvailability("AK19")).toBeNull();
    expect(checkAvailabilityAlerts).not.toHaveBeenCalled();

    pending.resolve({ saved: 1, skipped: 0 });
    await vi.advanceTimersByTimeAsync(0);

    expect(getCachedAvailability("AK19")).toEqual(record);
    expect(checkAvailabilityAlerts).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(2);
  });

  it("does not publish or check alerts after stopping during a write", async () => {
    const pending = deferred<{ saved: number; skipped: number }>();
    saveAvailabilityRecords.mockReturnValueOnce(pending.promise);

    stopPoller = startAvailabilityPoller(
      vi.fn().mockResolvedValue(undefined),
      undefined,
      { saveAvailabilityRecords },
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(saveAvailabilityRecords).toHaveBeenCalledTimes(1);

    stopPoller();

    pending.resolve({ saved: 1, skipped: 0 });
    await vi.advanceTimersByTimeAsync(0);

    expect(getCachedAvailability("AK19")).toBeNull();
    expect(checkAvailabilityAlerts).not.toHaveBeenCalled();
  });
});
