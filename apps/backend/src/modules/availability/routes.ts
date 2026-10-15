import { Router } from "express";
import { ApiException } from "../../lib/errors/index.js";
import type { AvailabilityRepository } from "./repository.js";

export function createAvailabilityRouter(
  repository: Pick<AvailabilityRepository, "getAvailabilityByCarParkNo">,
): Router {
  const router: Router = Router();

  router.get("/:carParkNo/availability", async (req, res, next) => {
    try {
      const availability = await repository.getAvailabilityByCarParkNo(
        req.params.carParkNo,
      );

      if (!availability) {
        next(
          new ApiException(404, "NOT_FOUND", "Carpark availability not found"),
        );
        return;
      }

      res.status(200).json(availability);
    } catch {
      next(
        new ApiException(
          503,
          "EXTERNAL_SERVICE_UNAVAILABLE",
          "Availability service unavailable",
        ),
      );
    }
  });

  return router;
}
