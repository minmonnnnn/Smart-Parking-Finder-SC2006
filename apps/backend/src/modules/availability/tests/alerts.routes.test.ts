import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAlertRouter, type VerifyAlertToken } from "../alerts.routes.js";
import { replaceAvailabilityCache } from "../cache.js";
import { getEnabledAlerts } from "../alerts.repository.js";

const verifyToken = vi.fn<VerifyAlertToken>();

const app = express();

app.use(express.json());
app.use("/api/alerts", createAlertRouter(verifyToken));

function seedAvailability() {
  replaceAvailabilityCache([
    {
      carParkNo: "AK19",
      availableLots: 60,
      totalLots: 100,
      fetchedAt: new Date(),
    },
  ]);
}

async function createOwnedAlert() {
  const response = await request(app)
    .post("/api/alerts")
    .set("Authorization", "Bearer user-1-token")
    .send({ carParkNo: "AK19" });

  expect(response.status).toBe(201);

  return String(response.body.alertId);
}

describe("availability alert routes", () => {
  beforeEach(() => {
    seedAvailability();

    verifyToken.mockReset();
    verifyToken.mockImplementation(async (token) => {
      if (token === "user-1-token") {
        return { userId: "user-1" };
      }

      if (token === "user-2-token") {
        return { userId: "user-2" };
      }

      return null;
    });
  });

  it("creates an alert owned by the authenticated user", async () => {
    const alertId = await createOwnedAlert();

    expect(getEnabledAlerts()).toContainEqual(
      expect.objectContaining({
        id: Number(alertId),
        userId: "user-1",
        carParkNo: "AK19",
        enabled: true,
      }),
    );
  });

  it("ignores a body-supplied owner ID", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .send({
        carParkNo: "AK19",
        userId: "user-2",
      });

    expect(response.status).toBe(201);

    expect(getEnabledAlerts()).toContainEqual(
      expect.objectContaining({
        id: Number(response.body.alertId),
        userId: "user-1",
      }),
    );
  });

  it("returns 404 for an unknown carpark", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .send({ carParkNo: "ZZ99" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("allows the owner to disable an alert", async () => {
    const alertId = await createOwnedAlert();

    const response = await request(app)
      .patch(`/api/alerts/${alertId}`)
      .set("Authorization", "Bearer user-1-token")
      .send({ enabled: false });

    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(false);
  });

  it("allows the owner to re-enable an alert", async () => {
    const alertId = await createOwnedAlert();

    const disabled = await request(app)
      .patch(`/api/alerts/${alertId}`)
      .set("Authorization", "Bearer user-1-token")
      .send({ enabled: false });

    expect(disabled.status).toBe(200);

    const enabled = await request(app)
      .patch(`/api/alerts/${alertId}`)
      .set("Authorization", "Bearer user-1-token")
      .send({ enabled: true });

    expect(enabled.status).toBe(200);
    expect(enabled.body.enabled).toBe(true);
  });

  it("does not let another user disable an alert", async () => {
    const alertId = await createOwnedAlert();

    const response = await request(app)
      .patch(`/api/alerts/${alertId}`)
      .set("Authorization", "Bearer user-2-token")
      .send({ enabled: false });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");

    expect(getEnabledAlerts()).toContainEqual(
      expect.objectContaining({
        id: Number(alertId),
        userId: "user-1",
        enabled: true,
      }),
    );
  });

  it.each([
    {},
    { carParkNo: "" },
    { carParkNo: "   " },
    { carParkNo: 123 },
    { carParkNo: null },
    [],
  ])("rejects invalid POST body %j", async (body) => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects POST without a body", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("trims the carpark identifier", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .send({ carParkNo: " AK19 " });

    expect(response.status).toBe(201);
    expect(response.body.carParkNo).toBe("AK19");
  });

  it.each(["0", "-1", "1.5", "abc", "1e2", "9007199254740992"])(
    "rejects invalid alert id %s",
    async (id) => {
      const response = await request(app)
        .patch(`/api/alerts/${id}`)
        .set("Authorization", "Bearer user-1-token")
        .send({ enabled: false });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    },
  );

  it.each([{}, { enabled: "false" }, { enabled: 0 }, { enabled: null }, []])(
    "rejects invalid PATCH body %j",
    async (body) => {
      const response = await request(app)
        .patch("/api/alerts/1")
        .set("Authorization", "Bearer user-1-token")
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    },
  );

  it("rejects PATCH without a body", async () => {
    const response = await request(app)
      .patch("/api/alerts/1")
      .set("Authorization", "Bearer user-1-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for an unknown alert", async () => {
    const response = await request(app)
      .patch("/api/alerts/2147483647")
      .set("Authorization", "Bearer user-1-token")
      .send({ enabled: false });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects POST without authorization", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .send({ carParkNo: "AK19" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("rejects PATCH without authorization", async () => {
    const response = await request(app)
      .patch("/api/alerts/1")
      .send({ enabled: false });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it.each(["Basic user-1-token", "Bearer", "Bearer token extra"])(
    "rejects malformed authorization %s",
    async (header) => {
      const response = await request(app)
        .post("/api/alerts")
        .set("Authorization", header)
        .send({ carParkNo: "AK19" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
      expect(verifyToken).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid token", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer invalid-token")
      .send({ carParkNo: "AK19" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 503 when token verification is unavailable", async () => {
    verifyToken.mockRejectedValueOnce(
      new Error("Authentication service unavailable"),
    );

    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .send({ carParkNo: "AK19" });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("EXTERNAL_SERVICE_UNAVAILABLE");
  });
});
