import { fetchCarparkAvailability } from "./api.js";
import type { AvailabilityRepository } from "./repository.js";
import { createAvailabilityFetcher, type LtaSourceOptions } from "./sources.js";

const POLL_INTERVAL_MS = 60 * 1000;

export interface AvailabilityPollerOptions {
  lta?: LtaSourceOptions;
  checkAlerts?: () => Promise<void>;
}

export function startAvailabilityPoller(
  repository: Pick<AvailabilityRepository, "saveAvailabilityRecords">,
  options: AvailabilityPollerOptions = {},
): () => void {
  const fetchLatest = options.lta
    ? createAvailabilityFetcher(options.lta)
    : fetchCarparkAvailability;

  let running = false;
  let stopped = false;

  async function refreshAvailability(): Promise<void> {
    if (running || stopped) return;

    running = true;

    try {
      const records = await fetchLatest();

      if (stopped) return;

      await repository.saveAvailabilityRecords(records);

      if (stopped) return;

      await options.checkAlerts?.();
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
