import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAvailabilityAlerts,
  hasSignificantAvailabilityChange,
  type SendAvailabilityNotification,
} from "../alerts.service.js";
import {
  getEnabledAlerts,
  updateAlertLastKnownStatus,
  type AvailabilityAlert,
} from "../alerts.repository.js";
import { getAvailabilityByCarParkNo } from "../repository.js";
import type { AvailabilityInfo } from "../service.js";

vi.mock("../alerts.repository.js", () => ({
  getEnabledAlerts: vi.fn(),
  updateAlertLastKnownStatus: vi.fn(),
}));

vi.mock("../repository.js", () => ({
  getAvailabilityByCarParkNo: vi.fn(),
}));

describe("availability alert checks", () => {
  let alert: AvailabilityAlert;

  const sendNotification = vi.fn<SendAvailabilityNotification>();

  const availability: AvailabilityInfo = {
    availableLots: 30,
    totalLots: 100,
    status: "Moderate",
    lastUpdated: "2026-10-05T02:00:00Z",
    isStale: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();

    alert = {
      id: 1,
      userId: "user-1",
      carParkNo: "AK19",
      enabled: true,
      lastKnownStatus: "High",
    };

    vi.mocked(getEnabledAlerts).mockReturnValue([alert]);

    vi.mocked(getAvailabilityByCarParkNo).mockReturnValue(availability);

    vi.mocked(updateAlertLastKnownStatus).mockImplementation((_id, status) => {
      alert.lastKnownStatus = status;
      return alert;
    });

    sendNotification.mockResolvedValue(undefined);

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("treats a tier change as significant", () => {
    expect(hasSignificantAvailabilityChange("High", "Moderate")).toBe(true);
  });

  it("does not treat an unchanged tier as significant", () => {
    expect(hasSignificantAvailabilityChange("High", "High")).toBe(false);
  });

  it("notifies the owner and updates the baseline", async () => {
    await checkAvailabilityAlerts(sendNotification);

    expect(sendNotification).toHaveBeenCalledExactlyOnceWith({
      alertId: 1,
      userId: "user-1",
      carParkNo: "AK19",
      previousStatus: "High",
      currentStatus: "Moderate",
    });

    expect(updateAlertLastKnownStatus).toHaveBeenCalledWith(1, "Moderate");
  });

  it("does not notify when the tier is unchanged", async () => {
    alert.lastKnownStatus = "Moderate";

    await checkAvailabilityAlerts(sendNotification);

    expect(sendNotification).not.toHaveBeenCalled();
    expect(updateAlertLastKnownStatus).not.toHaveBeenCalled();
  });

  it("does not repeat a successfully delivered change", async () => {
    await checkAvailabilityAlerts(sendNotification);
    await checkAvailabilityAlerts(sendNotification);

    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("does not notify when there are no enabled alerts", async () => {
    vi.mocked(getEnabledAlerts).mockReturnValue([]);

    await checkAvailabilityAlerts(sendNotification);

    expect(sendNotification).not.toHaveBeenCalled();
    expect(getAvailabilityByCarParkNo).not.toHaveBeenCalled();
  });

  it("skips missing availability", async () => {
    vi.mocked(getAvailabilityByCarParkNo).mockReturnValue(null);

    await checkAvailabilityAlerts(sendNotification);

    expect(sendNotification).not.toHaveBeenCalled();
    expect(updateAlertLastKnownStatus).not.toHaveBeenCalled();
  });

  it("skips stale availability", async () => {
    vi.mocked(getAvailabilityByCarParkNo).mockReturnValue({
      ...availability,
      isStale: true,
    });

    await checkAvailabilityAlerts(sendNotification);

    expect(sendNotification).not.toHaveBeenCalled();
    expect(updateAlertLastKnownStatus).not.toHaveBeenCalled();
  });

  it("retries a change after delivery fails", async () => {
    sendNotification
      .mockRejectedValueOnce(new Error("Delivery failed"))
      .mockResolvedValueOnce(undefined);

    await checkAvailabilityAlerts(sendNotification);

    expect(updateAlertLastKnownStatus).not.toHaveBeenCalled();
    expect(alert.lastKnownStatus).toBe("High");

    await checkAvailabilityAlerts(sendNotification);

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(alert.lastKnownStatus).toBe("Moderate");
  });

  it("continues processing after another delivery fails", async () => {
    vi.mocked(getEnabledAlerts).mockReturnValue([
      alert,
      {
        ...alert,
        id: 2,
        userId: "user-2",
        carParkNo: "BK25",
      },
    ]);

    sendNotification.mockRejectedValueOnce(new Error("Delivery failed"));

    await checkAvailabilityAlerts(sendNotification);

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification).toHaveBeenNthCalledWith(2, {
      alertId: 2,
      userId: "user-2",
      carParkNo: "BK25",
      previousStatus: "High",
      currentStatus: "Moderate",
    });

    expect(updateAlertLastKnownStatus).toHaveBeenCalledTimes(1);
    expect(updateAlertLastKnownStatus).toHaveBeenCalledWith(2, "Moderate");
  });
});
