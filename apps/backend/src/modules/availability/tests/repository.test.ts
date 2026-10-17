import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAvailabilityRepository,
  getAvailabilityForCarparks,
} from "../repository.js";

interface DatabaseResult {
  data: unknown;
  error: unknown;
}

function mockDatabase(results: DatabaseResult[]) {
  const calls: unknown[] = [];
  let resultIndex = 0;

  const database = {
    from(table: string) {
      calls.push(["from", table]);

      const result = results[resultIndex++];

      if (!result) throw new Error("Unexpected database query");

      const promise = Promise.resolve(result);

      const query = {
        select(columns: string) {
          calls.push(["select", columns]);
          return query;
        },

        eq(column: string, value: unknown) {
          calls.push(["eq", column, value]);
          return query;
        },

        in(column: string, values: string[]) {
          calls.push(["in", column, values]);
          return query;
        },

        upsert(rows: unknown, options: unknown) {
          calls.push(["upsert", rows, options]);
          return query;
        },

        async maybeSingle() {
          return result;
        },

        then: promise.then.bind(promise),
      };

      return query;
    },
  } as unknown as SupabaseClient;

  return { database, calls };
}

const fetchedAt = new Date("2026-10-15T02:00:00.000Z");

const record = {
  carParkNo: "AK19",
  availableLots: 20,
  totalLots: 100,
  fetchedAt,
};

describe("Supabase availability repository", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fetchedAt);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads persisted data and recalculates staleness as time passes", async () => {
    const result = {
      data: {
        available_lots: 20,
        total_lots: 100,
        fetched_at: fetchedAt.toISOString(),
      },
      error: null,
    };

    const { database, calls } = mockDatabase([result, result]);
    const repository = createAvailabilityRepository(database);

    await expect(
      repository.getAvailabilityByCarParkNo("AK19"),
    ).resolves.toEqual({
      availableLots: 20,
      totalLots: 100,
      status: "Moderate",
      lastUpdated: fetchedAt.toISOString(),
      isStale: false,
    });

    vi.advanceTimersByTime(180_001);

    await expect(
      repository.getAvailabilityByCarParkNo("AK19"),
    ).resolves.toEqual({
      availableLots: 20,
      totalLots: 100,
      status: "Moderate",
      lastUpdated: fetchedAt.toISOString(),
      isStale: true,
    });

    expect(calls).toContainEqual(["eq", "car_park_no", "AK19"]);
  });

  it("returns null when availability has not been stored", async () => {
    const { database } = mockDatabase([{ data: null, error: null }]);

    await expect(
      createAvailabilityRepository(database).getAvailabilityByCarParkNo(
        "UNKNOWN",
      ),
    ).resolves.toBeNull();
  });

  it("saves the newest record for known IDs and skips unknown IDs", async () => {
    const { database, calls } = mockDatabase([
      { data: [{ car_park_no: "AK19" }], error: null },
      { data: null, error: null },
    ]);

    await expect(
      createAvailabilityRepository(database).saveAvailabilityRecords([
        record,
        {
          ...record,
          availableLots: 1,
          fetchedAt: new Date("2026-10-15T01:59:00Z"),
        },
        { ...record, carParkNo: "UNKNOWN" },
      ]),
    ).resolves.toEqual({ saved: 1, skipped: 1 });

    expect(calls).toContainEqual([
      "upsert",
      [
        {
          car_park_no: "AK19",
          available_lots: 20,
          total_lots: 100,
          status: "Moderate",
          fetched_at: fetchedAt.toISOString(),
        },
      ],
      { onConflict: "car_park_no" },
    ]);
  });

  it("processes records beyond the first batch", async () => {
    const records = Array.from({ length: 401 }, (_, index) => ({
      ...record,
      carParkNo: `PARK${index}`,
    }));

    const { database } = mockDatabase([
      {
        data: records.slice(0, 400).map((item) => ({
          car_park_no: item.carParkNo,
        })),
        error: null,
      },
      { data: null, error: null },
      {
        data: [{ car_park_no: "PARK400" }],
        error: null,
      },
      { data: null, error: null },
    ]);

    await expect(
      createAvailabilityRepository(database).saveAvailabilityRecords(records),
    ).resolves.toEqual({ saved: 401, skipped: 0 });
  });

  it("does not query the database for an empty refresh", async () => {
    const { database, calls } = mockDatabase([]);

    await expect(
      createAvailabilityRepository(database).saveAvailabilityRecords([]),
    ).resolves.toEqual({ saved: 0, skipped: 0 });

    expect(calls).toEqual([]);
  });

  it("does not write when none of the carpark IDs exist", async () => {
    const { database, calls } = mockDatabase([{ data: [], error: null }]);

    await expect(
      createAvailabilityRepository(database).saveAvailabilityRecords([record]),
    ).resolves.toEqual({ saved: 0, skipped: 1 });

    expect(calls).toEqual([
      ["from", "carparks"],
      ["select", "car_park_no"],
      ["in", "car_park_no", ["AK19"]],
    ]);
  });

  it("propagates write failures", async () => {
    const failure = { code: "42501", message: "permission denied" };

    const { database } = mockDatabase([
      { data: [{ car_park_no: "AK19" }], error: null },
      { data: null, error: failure },
    ]);

    await expect(
      createAvailabilityRepository(database).saveAvailabilityRecords([record]),
    ).rejects.toBe(failure);
  });

  it("propagates read failures instead of reporting missing availability", async () => {
    const failure = { code: "42501", message: "permission denied" };
    const { database } = mockDatabase([{ data: null, error: failure }]);

    await expect(
      createAvailabilityRepository(database).getAvailabilityByCarParkNo("AK19"),
    ).rejects.toBe(failure);
  });
});

describe("bulk availability lookup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fetchedAt.getTime() + 4 * 60_000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not query the database for an empty list", async () => {
    const { database, calls } = mockDatabase([]);

    const result = await getAvailabilityForCarparks(database, []);

    expect(result.size).toBe(0);
    expect(calls).toEqual([]);
  });

  it("batches IDs and derives availability from saved timestamps", async () => {
    const ids = Array.from({ length: 401 }, (_, index) => `P${index}`);
    const row = {
      available_lots: 20,
      total_lots: 100,
      fetched_at: fetchedAt.toISOString(),
    };

    const { database, calls } = mockDatabase([
      {
        data: [{ ...row, car_park_no: "P0" }],
        error: null,
      },
      {
        data: [{ ...row, car_park_no: "P400" }],
        error: null,
      },
    ]);

    const result = await getAvailabilityForCarparks(database, ids);

    expect(result.size).toBe(2);
    expect(result.get("P0")).toEqual({
      availableLots: 20,
      totalLots: 100,
      status: "Moderate",
      lastUpdated: fetchedAt.toISOString(),
      isStale: true,
    });
    expect(result.has("P400")).toBe(true);
    expect(result.has("P1")).toBe(false);

    expect(calls).toContainEqual(["in", "car_park_no", ids.slice(0, 400)]);
    expect(calls).toContainEqual(["in", "car_park_no", ["P400"]]);
  });

  it("propagates database failures to the caller", async () => {
    const error = { message: "Database unavailable" };
    const { database } = mockDatabase([{ data: null, error }]);

    await expect(getAvailabilityForCarparks(database, ["AK19"])).rejects.toBe(
      error,
    );
  });
});
