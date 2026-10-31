import type {
  AvailabilityNotification,
  IAvailabilityObserver,
  SendAvailabilityNotification,
} from "./availability-observer.interface.js";

/**
 * Adapter allowing functional callback handlers to act as formal GoF Observers.
 */
export class CallbackAlertObserver implements IAvailabilityObserver {
  readonly name: string;
  private readonly handler: SendAvailabilityNotification;

  constructor(
    handler: SendAvailabilityNotification,
    name: string = "CallbackAlertObserver",
  ) {
    this.handler = handler;
    this.name = name;
  }

  async update(notification: AvailabilityNotification): Promise<void> {
    await this.handler(notification);
  }
}

