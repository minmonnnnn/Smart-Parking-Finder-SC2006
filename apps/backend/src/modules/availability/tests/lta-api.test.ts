import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchLtaAvailability,
  normalizeLtaAvailability,
  type LtaAvailabilityRecord,
} from "../lta-api.js";

const fetchMock = vi.fn<typeof fetch>();

function response(value: unknown[]) {
  return new Response(JSON.stringify({ value }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const sample = {
  CarParkID: "1",
  Agency: "LTA",
  LotType: "C",
  AvailableLots: 30,
};

describe("fetchLtaAvailability", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches car lots with the account key", async () => {
    fetchMock.mockResolvedValue(response([sample]));

    const records = await fetchLtaAvailability("test-key");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("CarParkAvailabilityv2?$skip=0"),
      expect.objectContaining({
        headers: {
          AccountKey: "test-key",
          Accept: "application/json",
        },
      }),
    );

    expect(records).toEqual([
      {
        externalId: "1",
        agency: "LTA",
        availableLots: 30,
        retrievedAt: expect.any(Date),
      },
    ]);
  });

  it("fetches subsequent pages", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(
          Array.from({ length: 500 }, (_, index) => ({
            ...sample,
            CarParkID: String(index),
          })),
        ),
      )
      .mockResolvedValueOnce(response([{ ...sample, CarParkID: "last" }]));

    const records = await fetchLtaAvailability("test-key");

    expect(records).toHaveLength(501);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("$skip=500"),
      expect.any(Object),
    );
  });

  it("skips non-car lots and invalid counts", async () => {
    fetchMock.mockResolvedValue(
      response([
        sample,
        { ...sample, LotType: "Y" },
        { ...sample, AvailableLots: -1 },
        { ...sample, AvailableLots: 1.5 },
        { ...sample, AvailableLots: "30" },
      ]),
    );

    expect(await fetchLtaAvailability("test-key")).toHaveLength(1);
  });

  it("rejects a missing key without fetching", async () => {
    await expect(fetchLtaAvailability("")).rejects.toThrow(
      "LTA AccountKey is required",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsuccessful responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(fetchLtaAvailability("test-key")).rejects.toThrow(
      "Failed to fetch LTA availability: 503",
    );
  });

  it("rejects malformed response envelopes", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ wrong: [] })));

    await expect(fetchLtaAvailability("test-key")).rejects.toThrow(
      "Invalid LTA availability response",
    );
  });
});

describe("normalizeLtaAvailability", () => {
  const record: LtaAvailabilityRecord = {
    externalId: "1",
    agency: "LTA",
    availableLots: 30,
    retrievedAt: new Date("2026-10-05T02:00:00Z"),
  };

  it("uses mapped capacity and the canonical carpark ID", () => {
    const resolve = vi.fn(() => ({
      carParkNo: "FIXTURE_LTA_1",
      totalLots: 100,
    }));

    expect(normalizeLtaAvailability([record], resolve)).toEqual([
      {
        carParkNo: "FIXTURE_LTA_1",
        availableLots: 30,
        totalLots: 100,
        fetchedAt: record.retrievedAt,
      },
    ]);

    expect(resolve).toHaveBeenCalledWith(record);
  });

  it("skips records without a mapping", () => {
    expect(normalizeLtaAvailability([record], () => null)).toEqual([]);
  });

  it("skips records whose available lots exceed capacity", () => {
    expect(
      normalizeLtaAvailability([record], () => ({
        carParkNo: "FIXTURE_LTA_1",
        totalLots: 10,
      })),
    ).toEqual([]);
  });
});
