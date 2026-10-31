import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCarparkAvailability } from "../api.js";
import { startAvailabilityPoller } from "../poller.js";
import type { AvailabilityRepository } from "../repository.js";

vi.mock("../api.js", () => ({
  fetchCarparkAvailability: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const record = {
  carParkNo: "AK19",
  availableLots: 60,
  totalLots: 100,
  fetchedAt: new Date("2026-10-17T02:00:00.000Z"),
};

describe("startAvailabilityPoller", () => {
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

  it("fetches, saves and checks immediately", async () => {
    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);
    expect(saveAvailabilityRecords).toHaveBeenCalledWith([record]);
    expect(checkAlerts).toHaveBeenCalledTimes(1);
  });

  it("refreshes every minute", async () => {
    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(59_999);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(2);
    expect(checkAlerts).toHaveBeenCalledTimes(2);
  });

  it("stops future refreshes", async () => {
    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(0);

    stop();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);
  });

  it("does not save or check when fetching fails", async () => {
    vi.mocked(fetchCarparkAvailability).mockRejectedValueOnce(
      new Error("Source unavailable"),
    );

    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(0);

    expect(saveAvailabilityRecords).not.toHaveBeenCalled();
    expect(checkAlerts).not.toHaveBeenCalled();
  });

  it("retries a failed fetch next minute", async () => {
    vi.mocked(fetchCarparkAvailability).mockRejectedValueOnce(
      new Error("Source unavailable"),
    );

    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(2);
    expect(saveAvailabilityRecords).toHaveBeenCalledTimes(1);
    expect(checkAlerts).toHaveBeenCalledTimes(1);
  });

  it("does not overlap pending fetches", async () => {
    const pending = deferred<(typeof record)[]>();
    vi.mocked(fetchCarparkAvailability).mockReturnValueOnce(pending.promise);

    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);
    expect(saveAvailabilityRecords).not.toHaveBeenCalled();

    pending.resolve([record]);
    await vi.advanceTimersByTimeAsync(0);

    expect(checkAlerts).toHaveBeenCalledTimes(1);
  });

  it("does not overlap pending alert checks", async () => {
    const pending = deferred<void>();
    checkAlerts.mockReturnValueOnce(pending.promise);

    stop = startAvailabilityPoller(repository, { checkAlerts });
    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(1);
    expect(checkAlerts).toHaveBeenCalledTimes(1);

    pending.resolve(undefined);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCarparkAvailability).toHaveBeenCalledTimes(2);
  });

  it("skips saving when stopped during fetching", async () => {
    const pending = deferred<(typeof record)[]>();
    vi.mocked(fetchCarparkAvailability).mockReturnValueOnce(pending.promise);

    stop = startAvailabilityPoller(repository, { checkAlerts });
    stop();

    pending.resolve([record]);
    await vi.advanceTimersByTimeAsync(0);

    expect(saveAvailabilityRecords).not.toHaveBeenCalled();
    expect(checkAlerts).not.toHaveBeenCalled();
  });

  it("saves when no alert checker is configured", async () => {
    stop = startAvailabilityPoller(repository);
    await vi.advanceTimersByTimeAsync(0);

    expect(saveAvailabilityRecords).toHaveBeenCalledWith([record]);
    expect(checkAlerts).not.toHaveBeenCalled();
  });
});
