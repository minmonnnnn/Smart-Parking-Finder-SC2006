import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAvailabilityAlerts,
  hasSignificantAvailabilityChange,
  type AlertCheckDependencies,
  type SendAvailabilityNotification,
} from "../alerts.service.js";
import type {
  AlertRepository,
  StoredAvailabilityAlert,
} from "../alerts.repository.js";
import type { AvailabilityRepository } from "../repository.js";
import type { AvailabilityInfo } from "../service.js";

describe("availability alert checks", () => {
  let alert: StoredAvailabilityAlert;

  const getEnabledAlerts = vi.fn<AlertRepository["getEnabledAlerts"]>();
  const updateAlertLastKnownStatus =
    vi.fn<AlertRepository["updateAlertLastKnownStatus"]>();
  const getAvailabilityByCarParkNo =
    vi.fn<AvailabilityRepository["getAvailabilityByCarParkNo"]>();
  const sendNotification = vi.fn<SendAvailabilityNotification>();

  const dependencies: AlertCheckDependencies = {
    alerts: { getEnabledAlerts, updateAlertLastKnownStatus },
    availability: { getAvailabilityByCarParkNo },
  };

  const availability: AvailabilityInfo = {
    availableLots: 20,
    totalLots: 100,
    status: "Moderate",
    lastUpdated: "2026-10-17T02:00:00.000Z",
    isStale: false,
  };

  const check = () => checkAvailabilityAlerts(sendNotification, dependencies);

  beforeEach(() => {
    vi.resetAllMocks();

    alert = {
      id: 1,
      userId: "user-1",
      carParkNo: "AK19",
      enabled: true,
      lastKnownStatus: "High",
    };

    getEnabledAlerts.mockImplementation(async () => [{ ...alert }]);
    getAvailabilityByCarParkNo.mockResolvedValue(availability);

    updateAlertLastKnownStatus.mockImplementation(async (id, status) => {
      if (id === alert.id) alert.lastKnownStatus = status;
      return { ...alert, id, lastKnownStatus: status };
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
    await check();

    expect(getAvailabilityByCarParkNo).toHaveBeenCalledWith("AK19");
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

    await check();

    expect(sendNotification).not.toHaveBeenCalled();
    expect(updateAlertLastKnownStatus).not.toHaveBeenCalled();
  });

  it("does not repeat a successfully saved change", async () => {
    await check();
    await check();

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(updateAlertLastKnownStatus).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there are no enabled alerts", async () => {
    getEnabledAlerts.mockResolvedValue([]);

    await check();

    expect(getAvailabilityByCarParkNo).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("skips disabled alerts", async () => {
    alert.enabled = false;

    await check();

    expect(getAvailabilityByCarParkNo).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("skips missing availability", async () => {
    getAvailabilityByCarParkNo.mockResolvedValue(null);

    await check();

    expect(sendNotification).not.toHaveBeenCalled();
    expect(updateAlertLastKnownStatus).not.toHaveBeenCalled();
  });

  it("skips stale availability", async () => {
    getAvailabilityByCarParkNo.mockResolvedValue({
      ...availability,
      isStale: true,
    });

    await check();

    expect(sendNotification).not.toHaveBeenCalled();
    expect(updateAlertLastKnownStatus).not.toHaveBeenCalled();
  });

  it("initializes a missing baseline without notifying", async () => {
    alert.lastKnownStatus = null;

    await check();

    expect(sendNotification).not.toHaveBeenCalled();
    expect(updateAlertLastKnownStatus).toHaveBeenCalledWith(1, "Moderate");
  });

  it("retries after delivery fails", async () => {
    sendNotification.mockRejectedValueOnce(new Error("Delivery failed"));

    await check();

    expect(updateAlertLastKnownStatus).not.toHaveBeenCalled();
    expect(alert.lastKnownStatus).toBe("High");

    await check();

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(alert.lastKnownStatus).toBe("Moderate");
  });

  it("continues after another delivery fails", async () => {
    getEnabledAlerts.mockResolvedValue([
      { ...alert },
      { ...alert, id: 2, userId: "user-2", carParkNo: "BK25" },
    ]);
    sendNotification.mockRejectedValueOnce(new Error("Delivery failed"));

    await check();

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ alertId: 2, userId: "user-2" }),
    );
    expect(updateAlertLastKnownStatus).toHaveBeenCalledExactlyOnceWith(
      2,
      "Moderate",
    );
  });

  it("continues after an availability lookup fails", async () => {
    getEnabledAlerts.mockResolvedValue([
      { ...alert },
      { ...alert, id: 2, carParkNo: "BK25" },
    ]);
    getAvailabilityByCarParkNo.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );

    await check();

    expect(sendNotification).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ alertId: 2 }),
    );
  });

  it("reports failure to load enabled alerts", async () => {
    const error = new Error("Database unavailable");
    getEnabledAlerts.mockRejectedValue(error);

    await expect(check()).rejects.toBe(error);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("keeps the old baseline when saving it fails", async () => {
    updateAlertLastKnownStatus.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );

    await check();

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(alert.lastKnownStatus).toBe("High");

    await check();

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(alert.lastKnownStatus).toBe("Moderate");
  });
});
