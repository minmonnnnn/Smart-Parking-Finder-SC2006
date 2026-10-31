import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvailabilityAlertMonitor } from "./AvailabilityAlertMonitor";
import { fetchAvailability, type AvailabilityInfo } from "../availability/api";

vi.mock("../availability/api", () => ({
  fetchAvailability: vi.fn(),
}));

const high: AvailabilityInfo = {
  availableLots: 60,
  totalLots: 100,
  status: "High",
  lastUpdated: "2026-10-18T02:00:00.000Z",
  isStale: false,
};

const moderate: AvailabilityInfo = {
  ...high,
  availableLots: 20,
  status: "Moderate",
};

async function tick(milliseconds = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe("AvailabilityAlertMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(fetchAvailability).mockResolvedValue(high);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("establishes a baseline without notifying", async () => {
    render(<AvailabilityAlertMonitor carParkNo="AK19" />);
    await tick();

    expect(fetchAvailability).toHaveBeenCalledWith(
      "AK19",
      expect.any(AbortSignal),
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("notifies when the tier changes", async () => {
    vi.mocked(fetchAvailability)
      .mockResolvedValueOnce(high)
      .mockResolvedValue(moderate);

    render(<AvailabilityAlertMonitor carParkNo="AK19" />);
    await tick();
    await tick(60_000);

    expect(screen.getByRole("status").textContent).toBe(
      "AK19 availability changed from High to Moderate. 20 of 100 lots available.",
    );
  });

  it("does not notify when availability remains in the same tier", async () => {
    render(<AvailabilityAlertMonitor carParkNo="AK19" />);
    await tick(120_000);

    expect(fetchAvailability).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("ignores stale changes until fresh data returns", async () => {
    vi.mocked(fetchAvailability)
      .mockResolvedValueOnce(high)
      .mockResolvedValueOnce({ ...moderate, isStale: true })
      .mockResolvedValue(moderate);

    render(<AvailabilityAlertMonitor carParkNo="AK19" />);
    await tick();
    await tick(60_000);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("outdated");

    await tick(60_000);

    expect(screen.getByRole("status").textContent).toContain(
      "High to Moderate",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retries a failed request without generating a false change", async () => {
    vi.mocked(fetchAvailability).mockRejectedValueOnce(
      new Error("Unavailable"),
    );

    render(<AvailabilityAlertMonitor carParkNo="AK19" />);
    await tick();

    expect(screen.getByRole("alert").textContent).toContain("Unable to check");

    await tick(60_000);

    expect(fetchAvailability).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stops requests and aborts when unmounted", async () => {
    const view = render(<AvailabilityAlertMonitor carParkNo="AK19" />);
    await tick();

    const signal = vi.mocked(fetchAvailability).mock.calls[0]?.[1];

    view.unmount();
    await tick(120_000);

    expect(signal?.aborted).toBe(true);
    expect(fetchAvailability).toHaveBeenCalledTimes(1);
  });

  it("does not overlap pending requests", async () => {
    let resolve!: (value: AvailabilityInfo) => void;

    vi.mocked(fetchAvailability).mockReturnValueOnce(
      new Promise<AvailabilityInfo>((done) => {
        resolve = done;
      }),
    );

    render(<AvailabilityAlertMonitor carParkNo="AK19" />);
    await tick(120_000);

    expect(fetchAvailability).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve(high);
      await vi.advanceTimersByTimeAsync(0);
    });

    await tick(60_000);

    expect(fetchAvailability).toHaveBeenCalledTimes(2);
  });

  it("resets the baseline when the carpark changes", async () => {
    vi.mocked(fetchAvailability)
      .mockResolvedValueOnce(high)
      .mockResolvedValue(moderate);

    const view = render(<AvailabilityAlertMonitor carParkNo="AK19" />);

    await tick();
    await tick(60_000);

    expect(screen.getByRole("status").textContent).toContain("AK19");

    view.rerender(<AvailabilityAlertMonitor carParkNo="BK25" />);
    await tick();

    expect(screen.queryByRole("status")).toBeNull();
    expect(fetchAvailability).toHaveBeenLastCalledWith(
      "BK25",
      expect.any(AbortSignal),
    );
  });
});
