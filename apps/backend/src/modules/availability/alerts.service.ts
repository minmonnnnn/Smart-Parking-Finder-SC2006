import type { AvailabilityStatus } from "./service.js";
import type { AvailabilityRepository } from "./repository.js";
import type { AlertRepository } from "./alerts.repository.js";

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

export interface AlertCheckDependencies {
  alerts: Pick<
    AlertRepository,
    "getEnabledAlerts" | "updateAlertLastKnownStatus"
  >;
  availability: Pick<AvailabilityRepository, "getAvailabilityByCarParkNo">;
}

/** A significant change is a change between availability tiers. */
export function hasSignificantAvailabilityChange(
  previousStatus: AvailabilityStatus,
  currentStatus: AvailabilityStatus,
): boolean {
  return previousStatus !== currentStatus;
}

export async function checkAvailabilityAlerts(
  sendNotification: SendAvailabilityNotification,
  dependencies: AlertCheckDependencies,
): Promise<void> {
  const alerts = await dependencies.alerts.getEnabledAlerts();

  for (const alert of alerts) {
    if (!alert.enabled) continue;

    try {
      const availability =
        await dependencies.availability.getAvailabilityByCarParkNo(
          alert.carParkNo,
        );

      if (!availability || availability.isStale) continue;

      if (alert.lastKnownStatus === null) {
        await dependencies.alerts.updateAlertLastKnownStatus(
          alert.id,
          availability.status,
        );
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

      await sendNotification({
        alertId: alert.id,
        userId: alert.userId,
        carParkNo: alert.carParkNo,
        previousStatus: alert.lastKnownStatus,
        currentStatus: availability.status,
      });

      await dependencies.alerts.updateAlertLastKnownStatus(
        alert.id,
        availability.status,
      );
    } catch (error) {
      console.error(`Failed to process availability alert ${alert.id}:`, error);
    }
  }
}
