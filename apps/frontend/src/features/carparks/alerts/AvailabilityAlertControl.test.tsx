import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvailabilityAlertControl } from "./AvailabilityAlertControl";
import { createAvailabilityAlert, updateAvailabilityAlert } from "./api";
import { AvailabilityAlertsProvider } from "./AvailabilityAlertsProvider";
import type { AvailabilityTestWindow } from "./AvailabilityAlertMonitor";

vi.mock("./api", () => ({
  createAvailabilityAlert: vi.fn(),
  updateAvailabilityAlert: vi.fn(),
}));

vi.mock("./AvailabilityAlertMonitor", () => ({
  AvailabilityAlertMonitor: () => null,
}));

function renderControl() {
  return render(
    <AvailabilityAlertsProvider userId="user-1" accessToken="test-token">
      <AvailabilityAlertControl
        carParkNo="AK19"
        userId="user-1"
        accessToken="test-token"
      />
    </AvailabilityAlertsProvider>,
  );
}

function checkbox() {
  return screen.getByRole("checkbox", {
    name: "Notify me when availability changes",
  }) as HTMLInputElement;
}

describe("AvailabilityAlertControl", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(createAvailabilityAlert).mockResolvedValue({
      alertId: "7",
      carParkNo: "AK19",
      enabled: true,
    });

    vi.mocked(updateAvailabilityAlert).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("requires sign-in", () => {
    render(
      <AvailabilityAlertsProvider userId={null} accessToken={null}>
        <AvailabilityAlertControl
          carParkNo="AK19"
          userId={null}
          accessToken={null}
        />
      </AvailabilityAlertsProvider>,
    );

    expect(
      screen.getByText("Sign in to enable availability alerts."),
    ).toBeTruthy();

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(createAvailabilityAlert).not.toHaveBeenCalled();
  });

  it("creates a subscription when enabled", async () => {
    renderControl();

    fireEvent.click(checkbox());

    await waitFor(() => {
      expect(checkbox().checked).toBe(true);
    });

    expect(createAvailabilityAlert).toHaveBeenCalledWith("AK19", "test-token");
  });

  it("shows a simulate alert button when enabled and triggers simulation", async () => {
    renderControl();

    expect(
      screen.queryByRole("button", { name: /Simulate Availability Alert/i }),
    ).toBeNull();

    fireEvent.click(checkbox());

    await waitFor(() => {
      expect(checkbox().checked).toBe(true);
    });

    const simulateBtn = await screen.findByRole("button", {
      name: /Simulate Availability Alert/i,
    });
    expect(simulateBtn).toBeInTheDocument();

    const testWindow = window as unknown as AvailabilityTestWindow;
    const simulateSpy = vi.fn();
    testWindow.__simulateAvailabilityAlert = simulateSpy;

    fireEvent.click(simulateBtn);
    expect(simulateSpy).toHaveBeenCalledWith({ carParkNo: "AK19" });
  });

  it("disables and re-enables the same subscription", async () => {
    renderControl();

    fireEvent.click(checkbox());

    await waitFor(() => {
      expect(checkbox().checked).toBe(true);
    });

    fireEvent.click(checkbox());

    await waitFor(() => {
      expect(checkbox().checked).toBe(false);
    });

    expect(updateAvailabilityAlert).toHaveBeenCalledWith(
      "7",
      false,
      "test-token",
    );

    fireEvent.click(checkbox());

    await waitFor(() => {
      expect(checkbox().checked).toBe(true);
    });

    expect(updateAvailabilityAlert).toHaveBeenCalledWith(
      "7",
      true,
      "test-token",
    );

    expect(createAvailabilityAlert).toHaveBeenCalledTimes(1);
  });

  it("keeps the toggle off if creation fails", async () => {
    vi.mocked(createAvailabilityAlert).mockRejectedValueOnce(
      new Error("Request failed"),
    );

    renderControl();
    fireEvent.click(checkbox());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Unable to update availability alerts",
    );

    expect(checkbox().checked).toBe(false);
  });

  it("keeps the toggle enabled if disabling fails", async () => {
    renderControl();

    fireEvent.click(checkbox());

    await waitFor(() => {
      expect(checkbox().checked).toBe(true);
    });

    vi.mocked(updateAvailabilityAlert).mockRejectedValueOnce(
      new Error("Request failed"),
    );

    fireEvent.click(checkbox());

    await screen.findByRole("alert");

    expect(checkbox().checked).toBe(true);
  });

  it("shows pending state and prevents duplicate requests", async () => {
    let resolve!: (
      value: Awaited<ReturnType<typeof createAvailabilityAlert>>,
    ) => void;

    vi.mocked(createAvailabilityAlert).mockReturnValueOnce(
      new Promise((resolvePromise) => {
        resolve = resolvePromise;
      }),
    );

    renderControl();

    fireEvent.click(checkbox());

    expect(screen.getByRole("status").textContent).toBe("Updating alert...");

    expect((screen.getByRole("group") as HTMLFieldSetElement).disabled).toBe(
      true,
    );

    fireEvent.click(checkbox());

    expect(createAvailabilityAlert).toHaveBeenCalledTimes(1);

    resolve({
      alertId: "7",
      carParkNo: "AK19",
      enabled: true,
    });

    await waitFor(() => {
      expect(checkbox().checked).toBe(true);
      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});
