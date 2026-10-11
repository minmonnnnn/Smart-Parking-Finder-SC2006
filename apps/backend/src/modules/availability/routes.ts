import { Router } from "express";
import { getAvailabilityByCarParkNo } from "./repository.js";

const router: Router = Router();

router.get("/:carParkNo/availability", (req, res) => {
  const { carParkNo } = req.params;

  const availability = getAvailabilityByCarParkNo(carParkNo);

  if (!availability) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Carpark availability not found",
      },
    });
  }

  return res.status(200).json(availability);
});

export default router;
