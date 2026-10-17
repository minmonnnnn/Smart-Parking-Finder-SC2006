import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCarparkAvailability } from "../api.js";
import { startAvailabilityPoller } from "../poller.js";
import type { AvailabilityRepository } from "../repository.js";

vi.mock("../api.js", () => ({
  fetchCarparkAvailability: vi.fn(),
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

describe("availability poller persistence", () => {
  let stop: (() => void) | undefined;

  const saveAvailabilityRecords =
    vi.fn<AvailabilityRepository["saveAvailabilityRecords"]>();
  const checkAlerts = vi.fn<() => Promise<void>>();
  const repository = { saveAvailabilityRecords };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(fetchCarparkAvailability).mockResolvedValue([record]);
    saveAvailabilityRecords.mockResolvedValue({ saved: 1, skipped: 0 });
    checkAlerts.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for persistence before checking alerts", async () => {
    const pending = deferred<{ saved: number; skipped: number }>();
    saveAvailabilityRecords.mockReturnValueOnce(pending.promise);

    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(0);

    expect(saveAvailabilityRecords).toHaveBeenCalledWith([record]);
    expect(checkAlerts).not.toHaveBeenCalled();

    pending.resolve({ saved: 1, skipped: 0 });
    await vi.advanceTimersByTimeAsync(0);

    expect(checkAlerts).toHaveBeenCalledTimes(1);
  });

  it("skips alerts after a failed write and retries next minute", async () => {
    saveAvailabilityRecords.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );

    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(0);

    expect(checkAlerts).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(saveAvailabilityRecords).toHaveBeenCalledTimes(2);
    expect(checkAlerts).toHaveBeenCalledTimes(1);
  });

  it("does not overlap pending database writes", async () => {
    const pending = deferred<{ saved: number; skipped: number }>();
    saveAvailabilityRecords.mockReturnValueOnce(pending.promise);

    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);
    expect(saveAvailabilityRecords).toHaveBeenCalledTimes(1);
    expect(checkAlerts).not.toHaveBeenCalled();

    pending.resolve({ saved: 1, skipped: 0 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(2);
  });

  it("skips alert checking when stopped during a database write", async () => {
    const pending = deferred<{ saved: number; skipped: number }>();
    saveAvailabilityRecords.mockReturnValueOnce(pending.promise);

    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(0);

    expect(saveAvailabilityRecords).toHaveBeenCalledTimes(1);

    stop();
    pending.resolve({ saved: 1, skipped: 0 });
    await vi.advanceTimersByTimeAsync(120_000);

    expect(checkAlerts).not.toHaveBeenCalled();
    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);
  });
});
