import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import availabilityRouter from "../routes.js";
import { replaceAvailabilityCache } from "../cache.js";

const app = express();

app.use(express.json());
app.use("/api/carparks", availabilityRouter);

describe("availability routes", () => {
  it("returns availability for an existing carpark", async () => {
    replaceAvailabilityCache([
      {
        carParkNo: "AK19",
        availableLots: 60,
        totalLots: 100,
        fetchedAt: new Date(),
      },
    ]);

    const response = await request(app).get("/api/carparks/AK19/availability");

    expect(response.status).toBe(200);
    expect(response.body.availableLots).toBe(60);
    expect(response.body.totalLots).toBe(100);
    expect(response.body.status).toBe("High");
  });

  it("returns 404 for an unknown carpark", async () => {
    replaceAvailabilityCache([]);
    const response = await request(app).get("/api/carparks/ZZ99/availability");

    expect(response.status).toBe(404);
  });
});
