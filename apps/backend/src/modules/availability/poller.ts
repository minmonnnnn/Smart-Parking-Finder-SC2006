import { fetchCarparkAvailability } from "./api.js";
import { replaceAvailabilityCache } from "./cache.js";
import {
  checkAvailabilityAlerts,
  type SendAvailabilityNotification,
} from "./alerts.service.js";
import { createAvailabilityFetcher, type LtaSourceOptions } from "./sources.js";

const POLL_INTERVAL_MS = 60 * 1000;

export function startAvailabilityPoller(
  sendNotification?: SendAvailabilityNotification,
  lta?: LtaSourceOptions,
): () => void {
  const fetchLatest = lta
    ? createAvailabilityFetcher(lta)
    : fetchCarparkAvailability;

  let running = false;
  let stopped = false;

  async function refreshAvailability(): Promise<void> {
    if (running || stopped) return;

    running = true;

    try {
      const latestData = await fetchLatest();

      if (stopped) return;

      replaceAvailabilityCache(latestData);

      if (sendNotification) {
        await checkAvailabilityAlerts(sendNotification);
      }
    } catch (error) {
      console.error("Failed to refresh carpark availability:", error);
    } finally {
      running = false;
    }
  }

  void refreshAvailability();

  const intervalId = setInterval(() => {
    void refreshAvailability();
  }, POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
