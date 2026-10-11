import { describe, expect, it } from "vitest";
import {
  createAlert,
  setAlertEnabled,
  getEnabledAlerts,
} from "../alerts.repository.js";

describe("availability alert repository", () => {
  it("creates an enabled alert owned by the user", () => {
    const alert = createAlert("user-1", "AK19", "High");

    expect(alert.userId).toBe("user-1");
    expect(alert.carParkNo).toBe("AK19");
    expect(alert.enabled).toBe(true);
    expect(alert.lastKnownStatus).toBe("High");

    setAlertEnabled(alert.id, "user-1", false);
  });

  it("allows the owner to disable an alert", () => {
    const alert = createAlert("user-1", "BK25", "Moderate");

    const updated = setAlertEnabled(alert.id, "user-1", false);

    expect(updated).not.toBeNull();
    expect(updated?.enabled).toBe(false);
  });

  it("returns null for an unknown alert", () => {
    const updated = setAlertEnabled(Number.MAX_SAFE_INTEGER, "user-1", false);

    expect(updated).toBeNull();
  });

  it("does not let another user change an alert", () => {
    const alert = createAlert("owner", "AK19", "High");

    const updated = setAlertEnabled(alert.id, "another-user", false);

    expect(updated).toBeNull();
    expect(alert.enabled).toBe(true);

    setAlertEnabled(alert.id, "owner", false);
  });

  it("excludes disabled alerts and includes re-enabled alerts", () => {
    const alert = createAlert("user-1", "DISABLED_TEST", "High");

    expect(getEnabledAlerts()).toContainEqual(
      expect.objectContaining({ id: alert.id }),
    );

    setAlertEnabled(alert.id, "user-1", false);

    expect(getEnabledAlerts()).not.toContainEqual(
      expect.objectContaining({ id: alert.id }),
    );

    setAlertEnabled(alert.id, "user-1", true);

    expect(getEnabledAlerts()).toContainEqual(
      expect.objectContaining({ id: alert.id }),
    );

    setAlertEnabled(alert.id, "user-1", false);
  });
});
