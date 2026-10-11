import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCarparkAvailability,
  type RawAvailabilityRecord,
} from "../api.js";
import {
  fetchLtaAvailability,
  type LtaAvailabilityRecord,
} from "../lta-api.js";
import { createAvailabilityFetcher } from "../sources.js";
import { isAvailabilityStale } from "../service.js";

vi.mock("../api.js", () => ({
  fetchCarparkAvailability: vi.fn(),
}));

vi.mock("../lta-api.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lta-api.js")>();

  return {
    ...original,
    fetchLtaAvailability: vi.fn(),
  };
});

const timestamp = new Date("2026-10-05T02:00:00Z");

const dataGovRecord: RawAvailabilityRecord = {
  carParkNo: "AK19",
  availableLots: 60,
  totalLots: 100,
  fetchedAt: timestamp,
};

const ltaRecord: LtaAvailabilityRecord = {
  externalId: "1",
  agency: "LTA",
  availableLots: 30,
  retrievedAt: timestamp,
};

function makeFetcher(carParkNo = "FIXTURE_LTA_1") {
  return createAvailabilityFetcher({
    accountKey: "test-key",
    resolveCarpark: () => ({
      carParkNo,
      totalLots: 100,
    }),
  });
}

describe("combined availability sources", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(fetchCarparkAvailability).mockResolvedValue([dataGovRecord]);

    vi.mocked(fetchLtaAvailability).mockResolvedValue([ltaRecord]);

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("combines data.gov.sg and mapped LTA records", async () => {
    const fetchLatest = makeFetcher();

    const records = await fetchLatest();

    expect(records).toHaveLength(2);
    expect(records).toContainEqual(dataGovRecord);
    expect(records).toContainEqual({
      carParkNo: "FIXTURE_LTA_1",
      availableLots: 30,
      totalLots: 100,
      fetchedAt: timestamp,
    });

    expect(fetchLtaAvailability).toHaveBeenCalledWith("test-key");
  });

  it("prefers data.gov.sg for duplicate IDs with equal timestamps", async () => {
    const fetchLatest = makeFetcher("AK19");

    expect(await fetchLatest()).toEqual([dataGovRecord]);
  });

  it("uses fresh LTA data instead of older overlapping data.gov.sg data", async () => {
    const freshTimestamp = new Date("2026-10-05T02:05:00Z");

    vi.mocked(fetchLtaAvailability).mockResolvedValue([
      {
        ...ltaRecord,
        retrievedAt: freshTimestamp,
      },
    ]);

    const fetchLatest = makeFetcher("AK19");

    expect(await fetchLatest()).toEqual([
      {
        carParkNo: "AK19",
        availableLots: 30,
        totalLots: 100,
        fetchedAt: freshTimestamp,
      },
    ]);
  });

  it("retains LTA's old timestamp when LTA fails", async () => {
    const fetchLatest = makeFetcher();

    await fetchLatest();

    vi.mocked(fetchLtaAvailability).mockRejectedValueOnce(
      new Error("LTA unavailable"),
    );

    vi.mocked(fetchCarparkAvailability).mockResolvedValueOnce([
      {
        ...dataGovRecord,
        fetchedAt: new Date("2026-10-05T02:05:00Z"),
      },
    ]);

    const records = await fetchLatest();
    const retained = records.find(
      (record) => record.carParkNo === "FIXTURE_LTA_1",
    );

    expect(retained?.fetchedAt).toEqual(timestamp);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T02:05:00Z"));

    expect(isAvailabilityStale(retained!.fetchedAt)).toBe(true);
  });

  it("retains data.gov.sg data when that source fails", async () => {
    const fetchLatest = makeFetcher();

    await fetchLatest();

    vi.mocked(fetchCarparkAvailability).mockRejectedValueOnce(
      new Error("data.gov.sg unavailable"),
    );

    const records = await fetchLatest();

    expect(records).toContainEqual(dataGovRecord);
    expect(records).toHaveLength(2);
  });

  it("returns available data if the other source fails on the first fetch", async () => {
    vi.mocked(fetchLtaAvailability).mockRejectedValueOnce(
      new Error("LTA unavailable"),
    );

    expect(await makeFetcher()()).toEqual([dataGovRecord]);
  });

  it("rejects when both sources fail", async () => {
    vi.mocked(fetchCarparkAvailability).mockRejectedValueOnce(
      new Error("data.gov.sg unavailable"),
    );

    vi.mocked(fetchLtaAvailability).mockRejectedValueOnce(
      new Error("LTA unavailable"),
    );

    await expect(makeFetcher()()).rejects.toThrow(
      "Both availability sources are unavailable",
    );
  });
});
