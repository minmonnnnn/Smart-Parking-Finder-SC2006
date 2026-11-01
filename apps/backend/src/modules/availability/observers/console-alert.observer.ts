import type {
  AvailabilityNotification,
  IAvailabilityObserver,
} from "./availability-observer.interface.js";

/**
 * Concrete Observer that logs real-time availability alerts to the backend console.
 */
export class ConsoleAlertObserver implements IAvailabilityObserver {
  readonly name = "ConsoleAlertObserver";

  update(notification: AvailabilityNotification): void {
    const timestamp = new Date().toLocaleTimeString("en-SG", {
      hour12: false,
    });

    console.log(
      `[${timestamp}] [AVAILABILITY ALERT] Alert #${notification.alertId} ` +
        `for User "${notification.userId}": Carpark "${notification.carParkNo}" ` +
        `status changed from "${notification.previousStatus}" ` +
        `to "${notification.currentStatus}"!`,
    );
  }
}

