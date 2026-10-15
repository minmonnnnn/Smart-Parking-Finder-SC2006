import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawAvailabilityRecord } from "./api.js";
import {
  buildAvailabilityInfo,
  getAvailabilityStatus,
  type AvailabilityInfo,
} from "./service.js";
import { getCachedAvailability } from "./cache.js";

interface AvailabilityRow {
  available_lots: number;
  total_lots: number;
  fetched_at: string;
}

export interface AvailabilityRepository {
  getAvailabilityByCarParkNo(
    carParkNo: string,
  ): Promise<AvailabilityInfo | null>;

  saveAvailabilityRecords(
    records: RawAvailabilityRecord[],
  ): Promise<{ saved: number; skipped: number }>;
}

export function getAvailabilityByCarParkNo(
  carParkNo: string,
): AvailabilityInfo | null {
  const item = getCachedAvailability(carParkNo);

  if (!item) return null;
  return buildAvailabilityInfo(
    item.availableLots,
    item.totalLots,
    item.fetchedAt,
  );
}

export function createAvailabilityRepository(
  client: SupabaseClient,
): AvailabilityRepository {
  return {
    async getAvailabilityByCarParkNo(carParkNo) {
      const { data, error } = await client
        .from("carpark_availability_cache")
        .select("available_lots,total_lots,fetched_at")
        .eq("car_park_no", carParkNo)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const row = data as AvailabilityRow;

      return buildAvailabilityInfo(
        row.available_lots,
        row.total_lots,
        new Date(row.fetched_at),
      );
    },

    async saveAvailabilityRecords(records) {
      const latest = new Map<string, RawAvailabilityRecord>();

      for (const record of records) {
        const previous = latest.get(record.carParkNo);

        if (
          !previous ||
          record.fetchedAt.getTime() >= previous.fetchedAt.getTime()
        ) {
          latest.set(record.carParkNo, record);
        }
      }

      const uniqueRecords = [...latest.values()];
      const batchSize = 400;
      let saved = 0;
      let skipped = 0;

      for (let offset = 0; offset < uniqueRecords.length; offset += batchSize) {
        const batch = uniqueRecords.slice(offset, offset + batchSize);

        const { data, error } = await client
          .from("carparks")
          .select("car_park_no")
          .in(
            "car_park_no",
            batch.map((record) => record.carParkNo),
          );

        if (error) throw error;
        if (!data) throw new Error("Missing static carpark lookup result");

        const knownIds = new Set(
          (data as { car_park_no: string }[]).map((row) => row.car_park_no),
        );

        const knownRecords = batch.filter((record) =>
          knownIds.has(record.carParkNo),
        );

        skipped += batch.length - knownRecords.length;

        if (knownRecords.length === 0) continue;

        const rows = knownRecords.map((record) => ({
          car_park_no: record.carParkNo,
          available_lots: record.availableLots,
          total_lots: record.totalLots,
          status: getAvailabilityStatus(record.availableLots, record.totalLots),
          fetched_at: record.fetchedAt.toISOString(),
        }));

        const { error: writeError } = await client
          .from("carpark_availability_cache")
          .upsert(rows, { onConflict: "car_park_no" });

        if (writeError) throw writeError;

        saved += rows.length;
      }

      return { saved, skipped };
    },
  };
}
