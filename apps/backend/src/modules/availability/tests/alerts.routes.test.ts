import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createAlertRouter, type VerifyAlertToken } from "../alerts.routes.js";
import type {
  AlertRepository,
  StoredAvailabilityAlert,
} from "../alerts.repository.js";
import type { AvailabilityRepository } from "../repository.js";
import type { AvailabilityInfo } from "../service.js";

const verifyToken = vi.fn<VerifyAlertToken>();
const createAlert = vi.fn<AlertRepository["createAlert"]>();
const setAlertEnabled = vi.fn<AlertRepository["setAlertEnabled"]>();
const getAvailabilityByCarParkNo =
  vi.fn<AvailabilityRepository["getAvailabilityByCarParkNo"]>();

let storedAlerts: Map<number, StoredAvailabilityAlert>;
let nextId: number;

const availability: AvailabilityInfo = {
  availableLots: 60,
  totalLots: 100,
  status: "High",
  lastUpdated: "2026-10-15T02:00:00.000Z",
  isStale: false,
};

const app = createApp({
  alerts: createAlertRouter({
    verifyToken,
    alerts: { createAlert, setAlertEnabled },
    availability: { getAvailabilityByCarParkNo },
  }),
});

async function createOwnedAlert(): Promise<string> {
  const response = await request(app)
    .post("/api/alerts")
    .set("Authorization", "Bearer user-1-token")
    .send({ carParkNo: "AK19" })
    .expect(201);

  expect(response.body.alertId).toEqual(expect.any(String));
  return response.body.alertId;
}

describe("availability alert routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    storedAlerts = new Map();
    nextId = 1;

    verifyToken.mockImplementation(async (token) => {
      if (token === "user-1-token") return { userId: "user-1" };
      if (token === "user-2-token") return { userId: "user-2" };
      return null;
    });

    getAvailabilityByCarParkNo.mockImplementation(async (carParkNo) =>
      carParkNo === "AK19" ? availability : null,
    );

    createAlert.mockImplementation(async (userId, carParkNo, status) => {
      const alert: StoredAvailabilityAlert = {
        id: nextId++,
        userId,
        carParkNo,
        enabled: true,
        lastKnownStatus: status,
      };

      storedAlerts.set(alert.id, alert);
      return { ...alert };
    });

    setAlertEnabled.mockImplementation(async (id, userId, enabled) => {
      const alert = storedAlerts.get(id);

      if (!alert || alert.userId !== userId) return null;

      alert.enabled = enabled;
      return { ...alert };
    });
  });

  it("creates an alert owned by the authenticated user", async () => {
    const alertId = await createOwnedAlert();

    expect(createAlert).toHaveBeenCalledWith("user-1", "AK19", "High");
    expect(storedAlerts.get(Number(alertId))).toMatchObject({
      userId: "user-1",
      carParkNo: "AK19",
      enabled: true,
    });
  });

  it("ignores a body-supplied owner ID", async () => {
    await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .send({ carParkNo: "AK19", userId: "user-2" })
      .expect(201);

    expect(createAlert).toHaveBeenCalledWith("user-1", "AK19", "High");
  });

  it("returns 404 for missing availability", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .send({ carParkNo: "ZZ99" })
      .expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(createAlert).not.toHaveBeenCalled();
  });

  it("allows the owner to disable an alert", async () => {
    const alertId = await createOwnedAlert();

    const response = await request(app)
      .patch(`/api/alerts/${alertId}`)
      .set("Authorization", "Bearer user-1-token")
      .send({ enabled: false })
      .expect(200);

    expect(response.body.enabled).toBe(false);
    expect(setAlertEnabled).toHaveBeenCalledWith(
      Number(alertId),
      "user-1",
      false,
    );
    expect(storedAlerts.get(Number(alertId))?.enabled).toBe(false);
  });

  it("allows the owner to re-enable an alert", async () => {
    const alertId = await createOwnedAlert();

    await request(app)
      .patch(`/api/alerts/${alertId}`)
      .set("Authorization", "Bearer user-1-token")
      .send({ enabled: false })
      .expect(200);

    const response = await request(app)
      .patch(`/api/alerts/${alertId}`)
      .set("Authorization", "Bearer user-1-token")
      .send({ enabled: true })
      .expect(200);

    expect(response.body.enabled).toBe(true);
  });

  it("does not let another user disable an alert", async () => {
    const alertId = await createOwnedAlert();

    const response = await request(app)
      .patch(`/api/alerts/${alertId}`)
      .set("Authorization", "Bearer user-2-token")
      .send({ enabled: false })
      .expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(setAlertEnabled).toHaveBeenCalledWith(
      Number(alertId),
      "user-2",
      false,
    );
    expect(storedAlerts.get(Number(alertId))?.enabled).toBe(true);
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
      .send(body)
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(createAlert).not.toHaveBeenCalled();
  });

  it("rejects POST without a body", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("trims the carpark identifier", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .send({ carParkNo: " AK19 " })
      .expect(201);

    expect(response.body.carParkNo).toBe("AK19");
    expect(getAvailabilityByCarParkNo).toHaveBeenCalledWith("AK19");
  });

  it.each(["0", "-1", "1.5", "abc", "1e2", "2147483648", "9007199254740992"])(
    "rejects invalid alert id %s",
    async (id) => {
      const response = await request(app)
        .patch(`/api/alerts/${id}`)
        .set("Authorization", "Bearer user-1-token")
        .send({ enabled: false })
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(setAlertEnabled).not.toHaveBeenCalled();
    },
  );

  it.each([{}, { enabled: "false" }, { enabled: 0 }, { enabled: null }, []])(
    "rejects invalid PATCH body %j",
    async (body) => {
      const response = await request(app)
        .patch("/api/alerts/1")
        .set("Authorization", "Bearer user-1-token")
        .send(body)
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    },
  );

  it("rejects PATCH without a body", async () => {
    const response = await request(app)
      .patch("/api/alerts/1")
      .set("Authorization", "Bearer user-1-token")
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for an unknown alert", async () => {
    const response = await request(app)
      .patch("/api/alerts/2147483647")
      .set("Authorization", "Bearer user-1-token")
      .send({ enabled: false })
      .expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it.each(["post", "patch"] as const)(
    "rejects %s without authorization",
    async (method) => {
      const pending =
        method === "post"
          ? request(app).post("/api/alerts")
          : request(app).patch("/api/alerts/1");

      const response = await pending
        .send(method === "post" ? { carParkNo: "AK19" } : { enabled: false })
        .expect(401);

      expect(response.body.error.code).toBe("UNAUTHORIZED");
      expect(verifyToken).not.toHaveBeenCalled();
      expect(createAlert).not.toHaveBeenCalled();
      expect(setAlertEnabled).not.toHaveBeenCalled();
    },
  );

  it.each([
    "Basic user-1-token",
    "Bearer",
    "Bearer token extra",
    "Bearer token,other",
    "Bearer  user-1-token",
  ])("rejects malformed authorization %s", async (header) => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", header)
      .send({ carParkNo: "AK19" })
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer invalid-token")
      .send({ carParkNo: "AK19" })
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 503 when token verification fails", async () => {
    verifyToken.mockRejectedValueOnce(
      new Error("Private authentication error"),
    );

    const response = await request(app)
      .post("/api/alerts")
      .set("Authorization", "Bearer user-1-token")
      .send({ carParkNo: "AK19" })
      .expect(503);

    expect(response.body.error.code).toBe("EXTERNAL_SERVICE_UNAVAILABLE");
  });

  it.each(["availability", "create", "patch"] as const)(
    "hides database errors during %s",
    async (operation) => {
      const failure = new Error("Private database error");

      if (operation === "availability") {
        getAvailabilityByCarParkNo.mockRejectedValueOnce(failure);
      } else if (operation === "create") {
        createAlert.mockRejectedValueOnce(failure);
      } else {
        setAlertEnabled.mockRejectedValueOnce(failure);
      }

      const pending =
        operation === "patch"
          ? request(app).patch("/api/alerts/1")
          : request(app).post("/api/alerts");

      const response = await pending
        .set("Authorization", "Bearer user-1-token")
        .send(
          operation === "patch" ? { enabled: false } : { carParkNo: "AK19" },
        )
        .expect(503);

      expect(response.body).toEqual({
        error: {
          code: "EXTERNAL_SERVICE_UNAVAILABLE",
          message: "Alerts service unavailable",
        },
      });
    },
  );
});
