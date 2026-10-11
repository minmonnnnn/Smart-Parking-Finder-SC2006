import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCarparkAvailability } from "../api.js";

const fetchMock = vi.fn<typeof fetch>();

function makeCarpark(
  available = "50",
  total = "100",
  updatedAt = "2026-10-05T10:00:00+08:00",
) {
  return {
    carpark_number: "AK19",
    update_datetime: updatedAt,
    carpark_info: [
      {
        lot_type: "C",
        lots_available: available,
        total_lots: total,
      },
    ],
  };
}

function mockCarparks(carparks: ReturnType<typeof makeCarpark>[]) {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [
          {
            timestamp: "2026-10-05T10:00:00+08:00",
            carpark_data: carparks,
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
}

describe("fetchCarparkAvailability", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("transforms carpark availability into internal records", async () => {
    mockCarparks([makeCarpark()]);

    const result = await fetchCarparkAvailability();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.data.gov.sg/v1/transport/carpark-availability",
    );

    expect(result).toEqual([
      {
        carParkNo: "AK19",
        availableLots: 50,
        totalLots: 100,
        fetchedAt: new Date("2026-10-05T10:00:00+08:00"),
      },
    ]);
  });

  it("selects car lots even when another category appears first", async () => {
    const carpark = makeCarpark();

    carpark.carpark_info.unshift({
      lot_type: "Y",
      lots_available: "5",
      total_lots: "10",
    });

    mockCarparks([carpark]);

    const result = await fetchCarparkAvailability();

    expect(result[0]?.availableLots).toBe(50);
    expect(result[0]?.totalLots).toBe(100);
  });

  it("skips carparks without car lots", async () => {
    const carpark = makeCarpark();

    carpark.carpark_info = [
      {
        lot_type: "Y",
        lots_available: "5",
        total_lots: "10",
      },
    ];

    mockCarparks([carpark]);

    expect(await fetchCarparkAvailability()).toEqual([]);
  });

  it("skips carparks without any lot categories", async () => {
    const carpark = makeCarpark();
    carpark.carpark_info = [];

    mockCarparks([carpark]);

    expect(await fetchCarparkAvailability()).toEqual([]);
  });

  it.each([
    ["", "100"],
    ["50", ""],
    ["abc", "100"],
    ["50", "abc"],
    ["-1", "100"],
    ["0", "-1"],
    ["101", "100"],
    ["1.5", "100"],
    ["50", "100.5"],
    ["Infinity", "100"],
  ])(
    "skips invalid counts: available=%s, total=%s",
    async (available, total) => {
      mockCarparks([makeCarpark(available, total)]);

      expect(await fetchCarparkAvailability()).toEqual([]);
    },
  );

  it("preserves a valid zero-capacity record", async () => {
    mockCarparks([makeCarpark("0", "0")]);

    const result = await fetchCarparkAvailability();

    expect(result[0]?.availableLots).toBe(0);
    expect(result[0]?.totalLots).toBe(0);
  });

  it("skips invalid timestamps", async () => {
    mockCarparks([makeCarpark("50", "100", "invalid-date")]);

    expect(await fetchCarparkAvailability()).toEqual([]);
  });

  it("keeps valid records when another record is invalid", async () => {
    mockCarparks([makeCarpark("invalid", "100"), makeCarpark("25", "100")]);

    const result = await fetchCarparkAvailability();

    expect(result).toHaveLength(1);
    expect(result[0]?.availableLots).toBe(25);
  });

  it("throws when the service returns an unsuccessful status", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(fetchCarparkAvailability()).rejects.toThrow(
      "Failed to fetch carpark availability: 503",
    );
  });

  it("throws when the response has no snapshot", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
      }),
    );

    await expect(fetchCarparkAvailability()).rejects.toThrow(
      "Invalid response from carpark availability API",
    );
  });

  it("propagates network failures", async () => {
    fetchMock.mockRejectedValue(new Error("Network unavailable"));

    await expect(fetchCarparkAvailability()).rejects.toThrow(
      "Network unavailable",
    );
  });
});
