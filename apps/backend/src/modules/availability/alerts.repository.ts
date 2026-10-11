import type { AvailabilityStatus } from "./service.js";

export interface AvailabilityAlert {
  id: number;
  userId: string;
  carParkNo: string;
  enabled: boolean;
  lastKnownStatus: AvailabilityStatus;
}

const alerts: AvailabilityAlert[] = [];
let nextId = 1;

export function createAlert(
  userId: string,
  carParkNo: string,
  lastKnownStatus: AvailabilityStatus,
): AvailabilityAlert {
  const alert: AvailabilityAlert = {
    id: nextId++,
    userId,
    carParkNo,
    enabled: true,
    lastKnownStatus,
  };

  alerts.push(alert);

  return alert;
}

export function setAlertEnabled(
  id: number,
  userId: string,
  enabled: boolean,
): AvailabilityAlert | null {
  const alert = alerts.find((item) => item.id === id && item.userId === userId);

  if (!alert) {
    return null;
  }

  alert.enabled = enabled;

  return alert;
}

export function getEnabledAlerts(): AvailabilityAlert[] {
  return alerts.filter((alert) => alert.enabled);
}

export function updateAlertLastKnownStatus(
  id: number,
  status: AvailabilityStatus,
): AvailabilityAlert | null {
  const alert = alerts.find((item) => item.id === id);

  if (!alert) {
    return null;
  }

  alert.lastKnownStatus = status;

  return alert;
}
