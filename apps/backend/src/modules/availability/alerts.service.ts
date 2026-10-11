import type { AvailabilityStatus } from "./service.js";
import { getAvailabilityByCarParkNo } from "./repository.js";
import {
  getEnabledAlerts,
  updateAlertLastKnownStatus,
} from "./alerts.repository.js";

export interface AvailabilityNotification {
  alertId: number;
  userId: string;
  carParkNo: string;
  previousStatus: AvailabilityStatus;
  currentStatus: AvailabilityStatus;
}

export type SendAvailabilityNotification = (
  notification: AvailabilityNotification,
) => Promise<void>;

/** A significant change is a change between availability tiers. */
export function hasSignificantAvailabilityChange(
  previousStatus: AvailabilityStatus,
  currentStatus: AvailabilityStatus,
): boolean {
  return previousStatus !== currentStatus;
}

export async function checkAvailabilityAlerts(
  sendNotification: SendAvailabilityNotification,
): Promise<void> {
  for (const alert of getEnabledAlerts()) {
    const availability = getAvailabilityByCarParkNo(alert.carParkNo);

    if (!availability || availability.isStale) {
      continue;
    }

    if (
      !hasSignificantAvailabilityChange(
        alert.lastKnownStatus,
        availability.status,
      )
    ) {
      continue;
    }

    try {
      await sendNotification({
        alertId: alert.id,
        userId: alert.userId,
        carParkNo: alert.carParkNo,
        previousStatus: alert.lastKnownStatus,
        currentStatus: availability.status,
      });

      updateAlertLastKnownStatus(alert.id, availability.status);
    } catch (error) {
      console.error(`Failed to send availability alert ${alert.id}:`, error);
    }
  }
}
