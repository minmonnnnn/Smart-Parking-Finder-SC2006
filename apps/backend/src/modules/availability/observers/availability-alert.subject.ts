import type { AlertRepository } from "../alerts.repository.js";
import type { AvailabilityRepository } from "../repository.js";
import type { AvailabilityStatus } from "../service.js";
import type {
  AvailabilityNotification,
  IAvailabilityObserver,
  IAvailabilitySubject,
} from "./availability-observer.interface.js";

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

/**
 * GoF Concrete Subject: AvailabilityAlertSubject
 * Maintains a subscriber list of IAvailabilityObserver instances and
 * notifies them whenever a carpark crosses an availability status threshold.
 */
export class AvailabilityAlertSubject implements IAvailabilitySubject {
  private observers: Set<IAvailabilityObserver> = new Set();

  /**
   * Registers a new observer to receive availability alerts.
   */
  attach(observer: IAvailabilityObserver): void {
    this.observers.add(observer);
  }

  /**
   * Deregisters an observer from receiving availability alerts.
   */
  detach(observer: IAvailabilityObserver): void {
    this.observers.delete(observer);
  }

  /**
   * Returns a snapshot of currently registered observers.
   */
  getObservers(): ReadonlyArray<IAvailabilityObserver> {
    return Array.from(this.observers);
  }

  /**
   * Broadcasts a notification to all registered observers.
   * Ensures all observers are called, accumulating any errors before rethrowing.
   */
  async notify(notification: AvailabilityNotification): Promise<void> {
    const errors: unknown[] = [];

    for (const observer of this.observers) {
      try {
        await observer.update(notification);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw errors[0];
    }
  }

  /**
   * Scans active user alerts against latest carpark availability,
   * detecting significant status changes and triggering the Observer notification pipeline.
   */
  async checkAlerts(dependencies: AlertCheckDependencies): Promise<void> {
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

        await this.notify({
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
        console.error(
          `Failed to process availability alert ${alert.id}:`,
          error,
        );
      }
    }
  }
}

