import { fetchCarparkAvailability, type RawAvailabilityRecord } from "./api.js";
import {
  fetchLtaAvailability,
  normalizeLtaAvailability,
  type ResolveLtaCarpark,
} from "./lta-api.js";

export interface LtaSourceOptions {
  accountKey: string;
  resolveCarpark?: ResolveLtaCarpark;
  loadHdbCapacities?: () => Promise<ReadonlyMap<string, number>>;
}

/**
 * Poll both sources, retaining each source's last successful snapshot.
 * Automatic LTA matching accepts HDB records with exact known IDs only.
 * Fresh data.gov.sg capacities override saved fallback capacities.
 * Newer timestamps win overlaps; data.gov.sg wins ties.
 */
export function createAvailabilityFetcher(
  lta: LtaSourceOptions,
): () => Promise<RawAvailabilityRecord[]> {
  let dataGovSnapshot: RawAvailabilityRecord[] = [];
  let ltaSnapshot: RawAvailabilityRecord[] = [];
  let hdbCapacities = new Map<string, number>();

  const resolveCarpark: ResolveLtaCarpark =
    lta.resolveCarpark ??
    ((record) => {
      if (record.agency !== "HDB") return null;

      const totalLots = hdbCapacities.get(record.externalId);

      if (
        totalLots === undefined ||
        !Number.isInteger(totalLots) ||
        totalLots <= 0
      ) {
        return null;
      }

      return {
        carParkNo: record.externalId,
        totalLots,
      };
    });

  return async () => {
    const [dataGovResult, ltaResult, capacityResult] = await Promise.allSettled(
      [
        fetchCarparkAvailability(),
        fetchLtaAvailability(lta.accountKey),
        Promise.resolve().then(() => lta.loadHdbCapacities?.() ?? null),
      ],
    );

    if (
      capacityResult.status === "fulfilled" &&
      capacityResult.value !== null
    ) {
      hdbCapacities = new Map(capacityResult.value);
    } else if (capacityResult.status === "rejected") {
      console.error(
        "Saved HDB capacity lookup failed; retaining previous capacities",
      );
    }

    if (dataGovResult.status === "fulfilled") {
      dataGovSnapshot = dataGovResult.value;

      for (const record of dataGovSnapshot) {
        if (Number.isInteger(record.totalLots) && record.totalLots > 0) {
          hdbCapacities.set(record.carParkNo, record.totalLots);
        } else {
          hdbCapacities.delete(record.carParkNo);
        }
      }
    } else {
      console.error(
        "data.gov.sg availability refresh failed; retaining previous data",
      );
    }

    let ltaSucceeded = false;

    if (ltaResult.status === "fulfilled") {
      try {
        ltaSnapshot = normalizeLtaAvailability(ltaResult.value, resolveCarpark);
        ltaSucceeded = true;
      } catch {
        console.error(
          "LTA availability normalization failed; retaining previous data",
        );
      }
    } else {
      console.error("LTA availability refresh failed; retaining previous data");
    }

    if (dataGovResult.status === "rejected" && !ltaSucceeded) {
      throw new Error("Both availability sources are unavailable");
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
