import { Router } from "express";
import { createAlert, setAlertEnabled } from "./alerts.repository.js";
import { getAvailabilityByCarParkNo } from "./repository.js";

export type VerifyAlertToken = (
  token: string,
) => Promise<{ userId: string } | null>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createAlertRouter(verifyToken: VerifyAlertToken): Router {
  const router: Router = Router();

  router.use(async (req, res, next) => {
    const authorizationCount = req.rawHeaders.filter(
      (header, index) =>
        index % 2 === 0 && header.toLowerCase() === "authorization",
    ).length;

    const match = /^Bearer ([^\s,]+)$/i.exec(req.headers.authorization ?? "");

    if (authorizationCount !== 1 || !match) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Sign in to manage availability alerts",
        },
      });
    }

    let user: { userId: string } | null;

    try {
      user = await verifyToken(match[1]!);
    } catch {
      return res.status(503).json({
        error: {
          code: "EXTERNAL_SERVICE_UNAVAILABLE",
          message: "Authentication service unavailable",
        },
      });
    }

    if (!user || !user.userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Sign in to manage availability alerts",
        },
      });
    }

    res.locals.alertUserId = user.userId;
    next();
  });

  router.post("/", (req, res) => {
    const userId: unknown = res.locals.alertUserId;
    const body: unknown = req.body;

    if (typeof userId !== "string") {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Sign in to manage availability alerts",
        },
      });
    }

    if (
      !isObject(body) ||
      typeof body.carParkNo !== "string" ||
      body.carParkNo.trim() === ""
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "carParkNo must be a non-empty string",
        },
      });
    }

    const carParkNo = body.carParkNo.trim();
    const availability = getAvailabilityByCarParkNo(carParkNo);

    if (!availability) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Carpark availability not found",
        },
      });
    }

    const alert = createAlert(userId, carParkNo, availability.status);

    return res.status(201).json({
      alertId: String(alert.id),
      carParkNo: alert.carParkNo,
      enabled: alert.enabled,
    });
  });

  router.patch("/:id", (req, res) => {
    const userId: unknown = res.locals.alertUserId;
    const rawId = req.params.id;
    const id = Number(rawId);
    const body: unknown = req.body;

    if (typeof userId !== "string") {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Sign in to manage availability alerts",
        },
      });
    }

    if (
      !/^[1-9]\d*$/.test(rawId) ||
      !Number.isSafeInteger(id) ||
      !isObject(body) ||
      typeof body.enabled !== "boolean"
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "A positive integer alert id and boolean enabled are required",
        },
      });
    }

    const alert = setAlertEnabled(id, userId, body.enabled);

    if (!alert) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Alert not found",
        },
      });
    }

    return res.status(200).json({
      alertId: String(alert.id),
      carParkNo: alert.carParkNo,
      enabled: alert.enabled,
    });
  });

  return router;
}
