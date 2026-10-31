import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createAvailabilityRouter } from "../routes.js";
import type { AvailabilityRepository } from "../repository.js";
import type { AvailabilityInfo } from "../service.js";

const getAvailabilityByCarParkNo =
  vi.fn<AvailabilityRepository["getAvailabilityByCarParkNo"]>();

const app = createApp({
  availability: createAvailabilityRouter({
    getAvailabilityByCarParkNo,
  }),
});

const availability: AvailabilityInfo = {
  availableLots: 60,
  totalLots: 100,
  status: "High",
  lastUpdated: "2026-10-15T02:00:00.000Z",
  isStale: false,
};

describe("availability routes", () => {
  beforeEach(() => {
    getAvailabilityByCarParkNo.mockReset();
    getAvailabilityByCarParkNo.mockResolvedValue(availability);
  });

  it("returns availability without requiring sign-in", async () => {
    const response = await request(app)
      .get("/api/carparks/AK19/availability")
      .expect(200);

    expect(response.body).toEqual(availability);
    expect(getAvailabilityByCarParkNo).toHaveBeenCalledWith("AK19");
  });

  it("returns 404 when availability is missing", async () => {
    getAvailabilityByCarParkNo.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/carparks/UNKNOWN/availability")
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Carpark availability not found",
      },
    });
  });

  it("returns stale availability with its source timestamp", async () => {
    getAvailabilityByCarParkNo.mockResolvedValue({
      ...availability,
      isStale: true,
    });

    const response = await request(app)
      .get("/api/carparks/AK19/availability")
      .expect(200);

    expect(response.body.isStale).toBe(true);
    expect(response.body.lastUpdated).toBe(availability.lastUpdated);
  });

  it("returns a safe 503 response when the database fails", async () => {
    getAvailabilityByCarParkNo.mockRejectedValue(
      new Error("Private database error details"),
    );

    const response = await request(app)
      .get("/api/carparks/AK19/availability")
      .expect(503);

    expect(response.body).toEqual({
      error: {
        code: "EXTERNAL_SERVICE_UNAVAILABLE",
        message: "Availability service unavailable",
      },
    });
  });
});
