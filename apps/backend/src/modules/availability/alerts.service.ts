import {
  AvailabilityAlertSubject,
  CallbackAlertObserver,
  type AlertCheckDependencies,
  type AvailabilityNotification,
  type SendAvailabilityNotification,
  hasSignificantAvailabilityChange,
} from "./observers/index.js";

export type {
  AvailabilityNotification,
  SendAvailabilityNotification,
  AlertCheckDependencies,
};
export {
  hasSignificantAvailabilityChange,
  AvailabilityAlertSubject,
  CallbackAlertObserver,
};
export * from "./observers/index.js";

/**
 * Backwards-compatible convenience wrapper around AvailabilityAlertSubject.
 * Automatically wraps the callback in a CallbackAlertObserver and triggers checkAlerts.
 */
export async function checkAvailabilityAlerts(
  sendNotification: SendAvailabilityNotification,
  dependencies: AlertCheckDependencies,
): Promise<void> {
  const subject = new AvailabilityAlertSubject();
  subject.attach(new CallbackAlertObserver(sendNotification));
  await subject.checkAlerts(dependencies);
}
