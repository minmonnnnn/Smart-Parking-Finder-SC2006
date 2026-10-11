import { fetchCarparkAvailability, type RawAvailabilityRecord } from "./api.js";
import {
  fetchLtaAvailability,
  normalizeLtaAvailability,
  type ResolveLtaCarpark,
} from "./lta-api.js";

export interface LtaSourceOptions {
  accountKey: string;
  resolveCarpark: ResolveLtaCarpark;
}

/**
 * Create one fetcher per poller.
 * Each source retains its last successful snapshot.
 * For overlapping IDs, prefer the newest timestamp;
 * data.gov.sg wins ties.
 */
export function createAvailabilityFetcher(
  lta: LtaSourceOptions,
): () => Promise<RawAvailabilityRecord[]> {
  let dataGovSnapshot: RawAvailabilityRecord[] = [];
  let ltaSnapshot: RawAvailabilityRecord[] = [];

  return async () => {
    const [dataGovResult, ltaResult] = await Promise.allSettled([
      fetchCarparkAvailability(),
      fetchLtaAvailability(lta.accountKey).then((records) =>
        normalizeLtaAvailability(records, lta.resolveCarpark),
      ),
    ]);

    if (
      dataGovResult.status === "rejected" &&
      ltaResult.status === "rejected"
    ) {
      throw new Error("Both availability sources are unavailable");
    }

    if (dataGovResult.status === "fulfilled") {
      dataGovSnapshot = dataGovResult.value;
    } else {
      console.error(
        "data.gov.sg availability refresh failed; retaining previous data",
      );
    }

    if (ltaResult.status === "fulfilled") {
      ltaSnapshot = ltaResult.value;
    } else {
      console.error("LTA availability refresh failed; retaining previous data");
    }

    const merged = new Map<string, RawAvailabilityRecord>();

    for (const record of [...ltaSnapshot, ...dataGovSnapshot]) {
      const existing = merged.get(record.carParkNo);

      if (
        !existing ||
        record.fetchedAt.getTime() >= existing.fetchedAt.getTime()
      ) {
        merged.set(record.carParkNo, record);
      }
    }

    return [...merged.values()];
  };
}
