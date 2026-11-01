import type { AvailabilityStatus } from "../service.js";

/**
 * Notification payload emitted when a carpark changes availability tier.
 */
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

/**
 * GoF Observer Pattern: Observer Interface
 * Defines the updating interface for subscribers monitoring carpark availability alerts.
 */
export interface IAvailabilityObserver {
  readonly name: string;
  update(notification: AvailabilityNotification): Promise<void> | void;
}

/**
 * GoF Observer Pattern: Subject (Observable) Interface
 * Defines the contract for attaching, detaching, and broadcasting to observers.
 */
export interface IAvailabilitySubject {
  attach(observer: IAvailabilityObserver): void;
  detach(observer: IAvailabilityObserver): void;
  notify(notification: AvailabilityNotification): Promise<void>;
  getObservers(): ReadonlyArray<IAvailabilityObserver>;
}

