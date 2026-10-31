import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvailabilityAlertsProvider } from "./AvailabilityAlertsProvider";
import { AvailabilityAlertControl } from "./AvailabilityAlertControl";
import { createAvailabilityAlert, updateAvailabilityAlert } from "./api";
import { fetchAvailability, type AvailabilityInfo } from "../availability/api";

vi.mock("./api", () => ({
  createAvailabilityAlert: vi.fn(),
  updateAvailabilityAlert: vi.fn(),
}));

vi.mock("../availability/api", () => ({
  fetchAvailability: vi.fn(),
}));

const high: AvailabilityInfo = {
  availableLots: 60,
  totalLots: 100,
  status: "High",
  lastUpdated: "2026-10-28T02:00:00.000Z",
  isStale: false,
};

const moderate: AvailabilityInfo = {
  ...high,
  availableLots: 20,
  status: "Moderate",
};

function Pages({ userId }: { userId: string | null }) {
  const [page, setPage] = useState<"details" | "map">("details");

  return (
    <>
      <button onClick={() => setPage("map")}>Open map</button>
      <button onClick={() => setPage("details")}>Open details</button>

      {page === "map" ? (
        <p>Map page</p>
      ) : (
        <AvailabilityAlertControl
          carParkNo="AK19"
          userId={userId}
          accessToken={userId ? "test-token" : null}
        />
      )}
    </>
  );
}

function Fixture({ userId = "user-1" }: { userId?: string | null }) {
  return (
    <AvailabilityAlertsProvider
      userId={userId}
      accessToken={userId ? "test-token" : null}
    >
      <Pages userId={userId} />
    </AvailabilityAlertsProvider>
  );
}

function checkbox() {
  return screen.getByRole("checkbox", {
    name: "Notify me when availability changes",
  }) as HTMLInputElement;
}

async function tick(milliseconds = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

async function enableAlerts() {
  fireEvent.click(checkbox());
  await tick();
  expect(checkbox().checked).toBe(true);
}

describe("AvailabilityAlertsProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    vi.mocked(createAvailabilityAlert).mockResolvedValue({
      alertId: "7",
      carParkNo: "AK19",
      enabled: true,
    });
    vi.mocked(updateAvailabilityAlert).mockResolvedValue(undefined);
    vi.mocked(fetchAvailability).mockResolvedValue(high);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("keeps monitoring on the map and retains the toggle on return", async () => {
    render(<Fixture />);
    await enableAlerts();

    fireEvent.click(screen.getByRole("button", { name: "Open map" }));
    expect(screen.queryByRole("checkbox")).toBeNull();

    vi.mocked(fetchAvailability).mockResolvedValue(moderate);
    await tick(60_000);

    expect(screen.getByText("Map page")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "High to Moderate",
    );

    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(checkbox().checked).toBe(true);
    expect(createAvailabilityAlert).toHaveBeenCalledTimes(1);

    fireEvent.click(checkbox());
    await tick();

    expect(updateAvailabilityAlert).toHaveBeenCalledWith(
      "7",
      false,
      "test-token",
    );
    expect(screen.queryByRole("status")).toBeNull();

    const calls = vi.mocked(fetchAvailability).mock.calls.length;
    await tick(120_000);
    expect(fetchAvailability).toHaveBeenCalledTimes(calls);
  });

  it("dismisses a banner without losing the monitoring baseline", async () => {
    render(<Fixture />);
    await enableAlerts();

    vi.mocked(fetchAvailability).mockResolvedValue(moderate);
    await tick(60_000);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Dismiss availability notification for AK19",
      }),
    );
    expect(screen.queryByRole("status")).toBeNull();

    await tick(60_000);
    expect(screen.queryByRole("status")).toBeNull();

    vi.mocked(fetchAvailability).mockResolvedValue(high);
    await tick(60_000);

    expect(screen.getByRole("status").textContent).toContain(
      "Moderate to High",
    );
  });

  it("clears notifications and stops monitoring on logout", async () => {
    const view = render(<Fixture />);
    await enableAlerts();

    vi.mocked(fetchAvailability).mockResolvedValue(moderate);
    await tick(60_000);
    expect(screen.getByRole("status")).toBeTruthy();

    const signal = vi.mocked(fetchAvailability).mock.calls.at(-1)?.[1];
    const calls = vi.mocked(fetchAvailability).mock.calls.length;

    view.rerender(<Fixture userId={null} />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(signal?.aborted).toBe(true);

    await tick(120_000);
    expect(fetchAvailability).toHaveBeenCalledTimes(calls);

    view.rerender(<Fixture userId="user-2" />);
    expect(checkbox().checked).toBe(false);
  });

  it("finishes enabling after leaving details", async () => {
    let resolve!: (
      subscription: Awaited<ReturnType<typeof createAvailabilityAlert>>,
    ) => void;

    vi.mocked(createAvailabilityAlert).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );

    render(<Fixture />);
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole("button", { name: "Open map" }));

    await act(async () => {
      resolve({ alertId: "7", carParkNo: "AK19", enabled: true });
    });
    await tick();

    vi.mocked(fetchAvailability).mockResolvedValue(moderate);
    await tick(60_000);

    expect(screen.getByText("Map page")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "High to Moderate",
    );
  });

  it("ignores an old user's pending response after account changes", async () => {
    let resolve!: (
      subscription: Awaited<ReturnType<typeof createAvailabilityAlert>>,
    ) => void;

    vi.mocked(createAvailabilityAlert).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );

    const view = render(<Fixture />);
    fireEvent.click(checkbox());

    view.rerender(<Fixture userId="user-2" />);

    await act(async () => {
      resolve({ alertId: "7", carParkNo: "AK19", enabled: true });
    });
    await tick();

    expect(checkbox().checked).toBe(false);
    expect(fetchAvailability).not.toHaveBeenCalled();
  });
});
