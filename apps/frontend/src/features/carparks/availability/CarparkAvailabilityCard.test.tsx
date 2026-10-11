import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CarparkAvailabilityCard } from "./CarparkAvailabilityCard";
import { fetchAvailability, type AvailabilityInfo } from "./api";

vi.mock("./api", () => ({
  fetchAvailability: vi.fn(),
}));

const freshAvailability: AvailabilityInfo = {
  availableLots: 60,
  totalLots: 100,
  status: "High",
  lastUpdated: "2026-10-05T02:00:00Z",
  isStale: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function flushRequests() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("CarparkAvailabilityCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    vi.mocked(fetchAvailability).mockResolvedValue(freshAvailability);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows loading before availability arrives", async () => {
    const request = deferred<AvailabilityInfo>();

    vi.mocked(fetchAvailability).mockReturnValueOnce(request.promise);

    render(<CarparkAvailabilityCard carParkNo="AK19" name="Example Carpark" />);

    expect(screen.getByRole("status").textContent).toBe(
      "Loading availability...",
    );

    await act(async () => {
      request.resolve(freshAvailability);
      await request.promise;
    });

    expect(screen.getByText("60 / 100 lots available")).toBeTruthy();
  });

  it("fetches and displays availability", async () => {
    render(<CarparkAvailabilityCard carParkNo="AK19" name="Example Carpark" />);

    await flushRequests();

    expect(fetchAvailability).toHaveBeenCalledWith(
      "AK19",
      expect.any(AbortSignal),
    );

    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("60 / 100 lots available")).toBeTruthy();
  });

  it("shows the stale warning", async () => {
    vi.mocked(fetchAvailability).mockResolvedValueOnce({
      ...freshAvailability,
      isStale: true,
    });

    render(<CarparkAvailabilityCard carParkNo="AK19" name="Example Carpark" />);

    await flushRequests();

    expect(screen.getByText("Availability data may be outdated")).toBeTruthy();
  });

  it("shows an error when the request fails", async () => {
    vi.mocked(fetchAvailability).mockRejectedValueOnce(
      new Error("Service unavailable"),
    );

    render(<CarparkAvailabilityCard carParkNo="AK19" name="Example Carpark" />);

    await flushRequests();

    expect(screen.getByRole("alert").textContent).toBe(
      "Unable to load current availability",
    );
  });

  it("refreshes after one minute", async () => {
    vi.mocked(fetchAvailability)
      .mockResolvedValueOnce(freshAvailability)
      .mockResolvedValueOnce({
        ...freshAvailability,
        availableLots: 30,
        status: "Moderate",
      });

    render(<CarparkAvailabilityCard carParkNo="AK19" name="Example Carpark" />);

    await flushRequests();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_999);
    });

    expect(fetchAvailability).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(fetchAvailability).toHaveBeenCalledTimes(2);
    expect(screen.getByText("30 / 100 lots available")).toBeTruthy();
  });

  it("hides the old result when refreshing fails", async () => {
    vi.mocked(fetchAvailability)
      .mockResolvedValueOnce(freshAvailability)
      .mockRejectedValueOnce(new Error("Service unavailable"));

    render(<CarparkAvailabilityCard carParkNo="AK19" name="Example Carpark" />);

    await flushRequests();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("60 / 100 lots available")).toBeNull();
  });

  it("does not overlap requests", async () => {
    const request = deferred<AvailabilityInfo>();

    vi.mocked(fetchAvailability).mockReturnValueOnce(request.promise);

    render(<CarparkAvailabilityCard carParkNo="AK19" name="Example Carpark" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(fetchAvailability).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve(freshAvailability);
      await request.promise;
    });
  });

  it("aborts requests and stops refreshing after unmount", async () => {
    const request = deferred<AvailabilityInfo>();

    vi.mocked(fetchAvailability).mockReturnValueOnce(request.promise);

    const { unmount } = render(
      <CarparkAvailabilityCard carParkNo="AK19" name="Example Carpark" />,
    );

    const signal = vi.mocked(fetchAvailability).mock.calls[0]?.[1];

    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(fetchAvailability).toHaveBeenCalledTimes(1);
  });

  it("ignores a late response from the previous carpark", async () => {
    const oldRequest = deferred<AvailabilityInfo>();
    const newRequest = deferred<AvailabilityInfo>();

    vi.mocked(fetchAvailability)
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { rerender } = render(
      <CarparkAvailabilityCard carParkNo="AK19" name="First Carpark" />,
    );

    rerender(
      <CarparkAvailabilityCard carParkNo="HE12" name="Second Carpark" />,
    );

    await act(async () => {
      newRequest.resolve({
        ...freshAvailability,
        availableLots: 10,
        status: "Low",
      });
      await newRequest.promise;
    });

    expect(screen.getByText("10 / 100 lots available")).toBeTruthy();

    await act(async () => {
      oldRequest.resolve(freshAvailability);
      await oldRequest.promise;
    });

    expect(screen.getByText("10 / 100 lots available")).toBeTruthy();

    expect(screen.queryByText("60 / 100 lots available")).toBeNull();
  });
});
