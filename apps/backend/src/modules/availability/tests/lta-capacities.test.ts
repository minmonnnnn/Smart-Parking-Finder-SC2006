import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { loadHdbLtaCapacities } from "../lta-capacities.js";

interface DatabaseResult {
  data: unknown;
  error: unknown;
}

function mockDatabase(pages: DatabaseResult[]) {
  const range = vi.fn<(from: number, to: number) => Promise<DatabaseResult>>();

  for (const page of pages) {
    range.mockResolvedValueOnce(page);
  }

  const query = {
    select: () => query,
    gt: () => query,
    order: () => query,
    abortSignal: () => query,
    range,
  };

  const client = {
    from: vi.fn(() => query),
  } as unknown as SupabaseClient;

  return { client, range };
}

describe("saved HDB capacities", () => {
  it("loads saved capacities by canonical carpark ID", async () => {
    const { client } = mockDatabase([
      {
        data: [{ car_park_no: "AK19", total_lots: 100 }],
        error: null,
      },
    ]);

    const result = await loadHdbLtaCapacities(client);

    expect(result.get("AK19")).toBe(100);
    expect(result.size).toBe(1);
  });

  it("loads capacities beyond the first page", async () => {
    const rows = Array.from({ length: 401 }, (_, index) => ({
      car_park_no: `H${index}`,
      total_lots: 100,
    }));

    const { client, range } = mockDatabase([
      { data: rows.slice(0, 400), error: null },
      { data: rows.slice(400), error: null },
    ]);

    const result = await loadHdbLtaCapacities(client);

    expect(result.size).toBe(401);
    expect(result.get("H400")).toBe(100);
    expect(range).toHaveBeenNthCalledWith(1, 0, 399);
    expect(range).toHaveBeenNthCalledWith(2, 400, 799);
  });

  it("handles an empty cache", async () => {
    const { client } = mockDatabase([{ data: [], error: null }]);

    expect((await loadHdbLtaCapacities(client)).size).toBe(0);
  });

  it("propagates lookup failures", async () => {
    const error = { message: "Database unavailable" };
    const { client } = mockDatabase([{ data: null, error }]);

    await expect(loadHdbLtaCapacities(client)).rejects.toBe(error);
  });
});
