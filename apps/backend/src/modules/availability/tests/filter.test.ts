import { describe, expect, it } from "vitest";
import { filterCarparks } from "../filter.js";

const carparks = [
  {
    carParkNo: "A1",
    hasEvCharging: true,
    parkingCost: 1.5,
    availabilityStatus: "High" as const,
    isSheltered: false,
  },
  {
    carParkNo: "B1",
    hasEvCharging: false,
    parkingCost: 2.5,
    availabilityStatus: "Moderate" as const,
    isSheltered: true,
  },
  {
    carParkNo: "C1",
    hasEvCharging: true,
    parkingCost: 1.0,
    availabilityStatus: "Low" as const,
    isSheltered: true,
  },
];

describe("filterCarparks", () => {
  it("filters by EV charging", () => {
    const result = filterCarparks(carparks, {
      evChargingOnly: true,
    });

    expect(result.map((carpark) => carpark.carParkNo)).toEqual(["A1", "C1"]);
  });

  it("filters by maximum cost", () => {
    const result = filterCarparks(carparks, {
      maxCost: 1.5,
    });

    expect(result.map((carpark) => carpark.carParkNo)).toEqual(["A1", "C1"]);
  });

  it("filters by minimum availability", () => {
    const result = filterCarparks(carparks, {
      minAvailability: "Moderate",
    });

    expect(result.map((carpark) => carpark.carParkNo)).toEqual(["A1", "B1"]);
  });

  it("filters by sheltered carpark", () => {
    const result = filterCarparks(carparks, {
      shelteredOnly: true,
    });

    expect(result.map((carpark) => carpark.carParkNo)).toEqual(["B1", "C1"]);
  });
});

it("combines multiple filters using AND logic", () => {
  const result = filterCarparks(carparks, {
    evChargingOnly: true,
    maxCost: 1.5,
    minAvailability: "Moderate",
  });

  expect(result.map((carpark) => carpark.carParkNo)).toEqual(["A1"]);
});

it("returns all carparks when no filters are applied", () => {
  const result = filterCarparks(carparks, {});

  expect(result).toEqual(carparks);
});

describe("filter edge cases", () => {
  it("combines all four filters using AND logic", () => {
    const result = filterCarparks(carparks, {
      evChargingOnly: true,
      shelteredOnly: true,
      maxCost: 1,
      minAvailability: "Low",
    });

    expect(result.map((carpark) => carpark.carParkNo)).toEqual(["C1"]);
  });

  it("excludes unknown prices when a cost limit is applied", () => {
    const unknownPriceCarpark = {
      carParkNo: "D1",
      hasEvCharging: false,
      parkingCost: null,
      availabilityStatus: "High" as const,
      isSheltered: false,
    };

    expect(filterCarparks([unknownPriceCarpark], { maxCost: 2 })).toEqual([]);

    expect(filterCarparks([unknownPriceCarpark], {})).toEqual([
      unknownPriceCarpark,
    ]);
  });

  it("supports a zero-cost filter", () => {
    const freeCarpark = {
      carParkNo: "FREE",
      hasEvCharging: false,
      parkingCost: 0,
      availabilityStatus: "High" as const,
      isSheltered: false,
    };

    const result = filterCarparks([...carparks, freeCarpark], { maxCost: 0 });

    expect(result.map((carpark) => carpark.carParkNo)).toEqual(["FREE"]);
  });

  it("excludes unavailable carparks when minimum availability is Low", () => {
    const unavailableCarpark = {
      carParkNo: "FULL",
      hasEvCharging: true,
      parkingCost: 1,
      availabilityStatus: "Unavailable" as const,
      isSheltered: true,
    };

    const result = filterCarparks([...carparks, unavailableCarpark], {
      minAvailability: "Low",
    });

    expect(result.map((carpark) => carpark.carParkNo)).toEqual([
      "A1",
      "B1",
      "C1",
    ]);
  });

  it("restores all results when filters are cleared", () => {
    expect(filterCarparks(carparks, { evChargingOnly: true })).toHaveLength(2);

    expect(
      filterCarparks(carparks, {
        evChargingOnly: false,
        shelteredOnly: false,
      }),
    ).toEqual(carparks);
  });
});
