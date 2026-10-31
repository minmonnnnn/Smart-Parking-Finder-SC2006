import { Router } from "express";
import { ApiException } from "../../lib/errors/index.js";
import type { AlertRepository } from "./alerts.repository.js";
import type { AvailabilityRepository } from "./repository.js";

export type VerifyAlertToken = (
  token: string,
) => Promise<{ userId: string } | null>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface AlertRouterDependencies {
  verifyToken: VerifyAlertToken;
  alerts: Pick<AlertRepository, "createAlert" | "setAlertEnabled">;
  availability: Pick<AvailabilityRepository, "getAvailabilityByCarParkNo">;
}

const MAX_ALERT_ID = 2_147_483_647;

function unauthorized(): ApiException {
  return new ApiException(
    401,
    "UNAUTHORIZED",
    "Sign in to manage availability alerts",
  );
}

export function createAlertRouter(
  dependencies: AlertRouterDependencies,
): Router {
  const router: Router = Router();

  router.use(async (req, res, next) => {
    const authorizationCount = req.rawHeaders.filter(
      (header, index) =>
        index % 2 === 0 && header.toLowerCase() === "authorization",
    ).length;

    const match = /^Bearer ([^\s,]+)$/i.exec(req.headers.authorization ?? "");

    if (authorizationCount !== 1 || !match) {
      next(unauthorized());
      return;
    }

    let user: { userId: string } | null;

    try {
      user = await dependencies.verifyToken(match[1]!);
    } catch {
      next(
        new ApiException(
          503,
          "EXTERNAL_SERVICE_UNAVAILABLE",
          "Authentication service unavailable",
        ),
      );
      return;
    }

    if (!user || typeof user.userId !== "string" || !user.userId) {
      next(unauthorized());
      return;
    }

    res.locals.alertUserId = user.userId;
    next();
  });

  router.post("/", async (req, res, next) => {
    const userId: unknown = res.locals.alertUserId;
    const body: unknown = req.body;

    if (typeof userId !== "string") {
      next(unauthorized());
      return;
    }

    if (
      !isObject(body) ||
      typeof body.carParkNo !== "string" ||
      body.carParkNo.trim() === ""
    ) {
      next(
        new ApiException(
          400,
          "VALIDATION_ERROR",
          "carParkNo must be a non-empty string",
        ),
      );
      return;
    }

    const carParkNo = body.carParkNo.trim();

    try {
      const availability =
        await dependencies.availability.getAvailabilityByCarParkNo(carParkNo);

      if (!availability) {
        next(
          new ApiException(404, "NOT_FOUND", "Carpark availability not found"),
        );
        return;
      }

      const alert = await dependencies.alerts.createAlert(
        userId,
        carParkNo,
        availability.status,
      );

      res.status(201).json({
        alertId: String(alert.id),
        carParkNo: alert.carParkNo,
        enabled: alert.enabled,
      });
    } catch {
      next(
        new ApiException(
          503,
          "EXTERNAL_SERVICE_UNAVAILABLE",
          "Alerts service unavailable",
        ),
      );
    }
  });

  router.patch("/:id", async (req, res, next) => {
    const userId: unknown = res.locals.alertUserId;
    const rawId = req.params.id;
    const id = Number(rawId);
    const body: unknown = req.body;

    if (typeof userId !== "string") {
      next(unauthorized());
      return;
    }

    if (
      !/^[1-9]\d*$/.test(rawId) ||
      !Number.isSafeInteger(id) ||
      id > MAX_ALERT_ID ||
      !isObject(body) ||
      typeof body.enabled !== "boolean"
    ) {
      next(
        new ApiException(
          400,
          "VALIDATION_ERROR",
          "A valid positive integer alert id and boolean enabled are required",
        ),
      );
      return;
    }

    try {
      const alert = await dependencies.alerts.setAlertEnabled(
        id,
        userId,
        body.enabled,
      );

      if (!alert) {
        next(new ApiException(404, "NOT_FOUND", "Alert not found"));
        return;
      }

      res.status(200).json({
        alertId: String(alert.id),
        carParkNo: alert.carParkNo,
        enabled: alert.enabled,
      });
    } catch {
      next(
        new ApiException(
          503,
          "EXTERNAL_SERVICE_UNAVAILABLE",
          "Alerts service unavailable",
        ),
      );
    }
  });

  return router;
}
