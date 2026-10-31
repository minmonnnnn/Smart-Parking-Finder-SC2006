import type { SupabaseClient } from "@supabase/supabase-js";

interface CapacityRow {
  car_park_no: string;
  total_lots: number;
}

export async function loadHdbLtaCapacities(
  client: SupabaseClient,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const pageSize = 400;
  const signal = AbortSignal.timeout(15_000);

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("carpark_availability_cache")
      .select("car_park_no,total_lots")
      .gt("total_lots", 0)
      .order("car_park_no")
      .abortSignal(signal)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data) throw new Error("Missing capacity lookup result");

    const rows = data as CapacityRow[];

    for (const row of rows) {
      if (Number.isInteger(row.total_lots) && row.total_lots > 0) {
        result.set(row.car_park_no, row.total_lots);
      }
    }

    if (rows.length < pageSize) return result;
  }
}
