import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCarparkAvailability } from "../api.js";
import { getCachedAvailability, replaceAvailabilityCache } from "../cache.js";
import { checkAvailabilityAlerts } from "../alerts.service.js";
import { startAvailabilityPoller } from "../poller.js";

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

describe("startAvailabilityPoller", () => {
  let stopPoller: (() => void) | undefined;

  const record = {
    carParkNo: "AK19",
    availableLots: 50,
    totalLots: 100,
    fetchedAt: new Date("2026-10-04T00:00:00Z"),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    replaceAvailabilityCache([]);

    vi.mocked(fetchCarparkAvailability).mockResolvedValue([record]);
    vi.mocked(checkAvailabilityAlerts).mockResolvedValue(undefined);
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

  it("fetches immediately and updates the cache", async () => {
    stopPoller = startAvailabilityPoller(vi.fn().mockResolvedValue(undefined));

    await vi.advanceTimersByTimeAsync(0);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);
    expect(getCachedAvailability("AK19")).toEqual(record);
    expect(checkAvailabilityAlerts).toHaveBeenCalledTimes(1);
  });

  it("refreshes every minute", async () => {
    stopPoller = startAvailabilityPoller(vi.fn().mockResolvedValue(undefined));

    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(3);
  });

  it("stops future refreshes when stopped", async () => {
    stopPoller = startAvailabilityPoller(vi.fn().mockResolvedValue(undefined));

    await vi.advanceTimersByTimeAsync(0);

    stopPoller();

    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous cache when fetching fails", async () => {
    replaceAvailabilityCache([record]);

    vi.mocked(fetchCarparkAvailability).mockRejectedValueOnce(
      new Error("Service unavailable"),
    );

    stopPoller = startAvailabilityPoller(vi.fn().mockResolvedValue(undefined));

    await vi.advanceTimersByTimeAsync(0);

    expect(getCachedAvailability("AK19")).toEqual(record);
    expect(checkAvailabilityAlerts).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("tries again after a failed refresh", async () => {
    vi.mocked(fetchCarparkAvailability)
      .mockRejectedValueOnce(new Error("Service unavailable"))
      .mockResolvedValueOnce([record]);

    stopPoller = startAvailabilityPoller(vi.fn().mockResolvedValue(undefined));

    await vi.advanceTimersByTimeAsync(0);
    expect(getCachedAvailability("AK19")).toBeNull();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(2);
    expect(getCachedAvailability("AK19")).toEqual(record);
    expect(checkAvailabilityAlerts).toHaveBeenCalledTimes(1);
  });

  it("does not overlap requests while fetching", async () => {
    const pending =
      deferred<Awaited<ReturnType<typeof fetchCarparkAvailability>>>();

    vi.mocked(fetchCarparkAvailability).mockReturnValueOnce(pending.promise);

    stopPoller = startAvailabilityPoller(vi.fn().mockResolvedValue(undefined));

    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);

    pending.resolve([record]);
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(2);
  });

  it("does not overlap refreshes while checking alerts", async () => {
    const pending = deferred<void>();

    vi.mocked(checkAvailabilityAlerts).mockReturnValueOnce(pending.promise);

    const sender = vi.fn().mockResolvedValue(undefined);
    stopPoller = startAvailabilityPoller(sender);

    await vi.advanceTimersByTimeAsync(0);

    expect(checkAvailabilityAlerts).toHaveBeenCalledWith(sender);

    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);

    pending.resolve(undefined);
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(2);
  });

  it("does not update the cache if stopped during fetching", async () => {
    const pending =
      deferred<Awaited<ReturnType<typeof fetchCarparkAvailability>>>();

    vi.mocked(fetchCarparkAvailability).mockReturnValueOnce(pending.promise);

    stopPoller = startAvailabilityPoller(vi.fn().mockResolvedValue(undefined));

    stopPoller();

    pending.resolve([record]);
    await vi.advanceTimersByTimeAsync(0);

    expect(getCachedAvailability("AK19")).toBeNull();
    expect(checkAvailabilityAlerts).not.toHaveBeenCalled();
  });

  it("refreshes availability without a configured notification sender", async () => {
    stopPoller = startAvailabilityPoller();

    await vi.advanceTimersByTimeAsync(0);

    expect(getCachedAvailability("AK19")).toEqual(record);
    expect(checkAvailabilityAlerts).not.toHaveBeenCalled();
  });
});
