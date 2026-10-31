import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createAlertRepository } from "../alerts.repository.js";

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

        insert(value: unknown) {
          calls.push(["insert", value]);
          return query;
        },

        update(value: unknown) {
          calls.push(["update", value]);
          return query;
        },

        eq(column: string, value: unknown) {
          calls.push(["eq", column, value]);
          return query;
        },

        order(column: string) {
          calls.push(["order", column]);
          return query;
        },

        range(from: number, to: number) {
          calls.push(["range", from, to]);
          return query;
        },

        async single() {
          return result;
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

const row = {
  id: 7,
  user_id: "user-1",
  car_park_no: "AK19",
  enabled: true,
  last_known_status: "High",
};

const mapped = {
  id: 7,
  userId: "user-1",
  carParkNo: "AK19",
  enabled: true,
  lastKnownStatus: "High",
};

describe("Supabase alert repository", () => {
  it("creates an owned subscription and maps database fields", async () => {
    const { database, calls } = mockDatabase([{ data: row, error: null }]);

    await expect(
      createAlertRepository(database).createAlert("user-1", "AK19", "High"),
    ).resolves.toEqual(mapped);

    expect(calls).toContainEqual([
      "insert",
      {
        user_id: "user-1",
        car_park_no: "AK19",
        last_known_status: "High",
        enabled: true,
      },
    ]);
  });

  it("filters toggle updates by both alert ID and owner ID", async () => {
    const { database, calls } = mockDatabase([
      { data: { ...row, enabled: false }, error: null },
    ]);

    await expect(
      createAlertRepository(database).setAlertEnabled(7, "user-1", false),
    ).resolves.toEqual({ ...mapped, enabled: false });

    expect(calls).toContainEqual(["update", { enabled: false }]);
    expect(calls).toContainEqual(["eq", "id", 7]);
    expect(calls).toContainEqual(["eq", "user_id", "user-1"]);
  });

  it("returns null when an owned update matches no row", async () => {
    const { database } = mockDatabase([{ data: null, error: null }]);

    await expect(
      createAlertRepository(database).setAlertEnabled(7, "another-user", false),
    ).resolves.toBeNull();
  });

  it("retrieves only enabled subscriptions", async () => {
    const { database, calls } = mockDatabase([{ data: [row], error: null }]);

    await expect(
      createAlertRepository(database).getEnabledAlerts(),
    ).resolves.toEqual([mapped]);

    expect(calls).toContainEqual(["eq", "enabled", true]);
  });

  it("retrieves subscriptions beyond the first page", async () => {
    const firstPage = Array.from({ length: 400 }, (_, index) => ({
      ...row,
      id: index + 1,
    }));

    const { database, calls } = mockDatabase([
      { data: firstPage, error: null },
      { data: [{ ...row, id: 401 }], error: null },
    ]);

    const alerts = await createAlertRepository(database).getEnabledAlerts();

    expect(alerts).toHaveLength(401);
    expect(alerts[400]?.id).toBe(401);
    expect(calls).toContainEqual(["range", 0, 399]);
    expect(calls).toContainEqual(["range", 400, 799]);
  });

  it("preserves a null baseline for the checker to initialise", async () => {
    const { database } = mockDatabase([
      {
        data: [{ ...row, last_known_status: null }],
        error: null,
      },
    ]);

    await expect(
      createAlertRepository(database).getEnabledAlerts(),
    ).resolves.toEqual([{ ...mapped, lastKnownStatus: null }]);
  });

  it("updates the baseline for the internal checker", async () => {
    const { database, calls } = mockDatabase([
      {
        data: { ...row, last_known_status: "Low" },
        error: null,
      },
    ]);

    await expect(
      createAlertRepository(database).updateAlertLastKnownStatus(7, "Low"),
    ).resolves.toEqual({
      ...mapped,
      lastKnownStatus: "Low",
    });

    expect(calls).toContainEqual(["update", { last_known_status: "Low" }]);
    expect(calls).toContainEqual(["eq", "id", 7]);
  });

  it("propagates database errors", async () => {
    const failure = {
      code: "23503",
      message: "Missing referenced profile",
    };

    const { database } = mockDatabase([{ data: null, error: failure }]);

    await expect(
      createAlertRepository(database).createAlert("user-1", "AK19", "High"),
    ).rejects.toBe(failure);
  });
});
