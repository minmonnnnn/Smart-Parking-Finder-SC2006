import type { RawAvailabilityRecord } from "./api.js";

export interface LtaAvailabilityRecord {
  externalId: string;
  agency: "HDB" | "LTA" | "URA";
  availableLots: number;

  // Retrieval time, not a source-provided update timestamp.
  retrievedAt: Date;
}

export interface LtaCarparkMapping {
  carParkNo: string;
  totalLots: number;
}

export type ResolveLtaCarpark = (
  record: LtaAvailabilityRecord,
) => LtaCarparkMapping | null;

const LTA_URL =
  "https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function fetchLtaAvailability(
  accountKey: string,
): Promise<LtaAvailabilityRecord[]> {
  if (!accountKey.trim()) {
    throw new Error("LTA AccountKey is required");
  }

  const records: LtaAvailabilityRecord[] = [];

  for (let skip = 0; ; skip += 500) {
    const response = await fetch(`${LTA_URL}?$skip=${skip}`, {
      headers: {
        AccountKey: accountKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch LTA availability: ${response.status}`);
    }

    const body: unknown = await response.json();

    if (!isObject(body) || !Array.isArray(body.value)) {
      throw new Error("Invalid LTA availability response");
    }

    const page: unknown[] = body.value;
    const retrievedAt = new Date();

    for (const item of page) {
      if (
        !isObject(item) ||
        item.LotType !== "C" ||
        typeof item.CarParkID !== "string" ||
        item.CarParkID.trim() === "" ||
        typeof item.AvailableLots !== "number" ||
        !Number.isInteger(item.AvailableLots) ||
        item.AvailableLots < 0 ||
        (item.Agency !== "HDB" &&
          item.Agency !== "LTA" &&
          item.Agency !== "URA")
      ) {
        continue;
      }

      records.push({
        externalId: item.CarParkID.trim(),
        agency: item.Agency,
        availableLots: item.AvailableLots,
        retrievedAt,
      });
    }

    if (page.length < 500) {
      return records;
    }
  }
}

/**
 * Resolve IDs and capacities using static carpark data.
 * Unmapped records are excluded rather than assigned guessed capacities.
 */
export function normalizeLtaAvailability(
  records: LtaAvailabilityRecord[],
  resolveCarpark: ResolveLtaCarpark,
): RawAvailabilityRecord[] {
  return records.flatMap((record): RawAvailabilityRecord[] => {
    const mapping = resolveCarpark(record);

    if (
      !mapping ||
      mapping.carParkNo.trim() === "" ||
      !Number.isInteger(mapping.totalLots) ||
      mapping.totalLots < 0 ||
      record.availableLots > mapping.totalLots
    ) {
      return [];
    }

    return [
      {
        carParkNo: mapping.carParkNo,
        availableLots: record.availableLots,
        totalLots: mapping.totalLots,
        fetchedAt: record.retrievedAt,
      },
    ];
  });
}
