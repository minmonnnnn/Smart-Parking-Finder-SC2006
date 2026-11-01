import type {
  AvailabilityNotification,
  IAvailabilityObserver,
} from "./availability-observer.interface.js";

/**
 * Concrete Observer that captures notifications in memory.
 * Useful for automated testing, event auditing, or queuing notifications.
 */
export class InMemoryAlertObserver implements IAvailabilityObserver {
  readonly name = "InMemoryAlertObserver";
  private readonly notifications: AvailabilityNotification[] = [];

  update(notification: AvailabilityNotification): void {
    this.notifications.push(notification);
  }

  getNotifications(): ReadonlyArray<AvailabilityNotification> {
    return [...this.notifications];
  }

  clear(): void {
    this.notifications.length = 0;
  }
}

