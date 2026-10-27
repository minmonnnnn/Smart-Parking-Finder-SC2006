import { Router, type Request, type Response, type NextFunction } from 'express';
import { getDrivingRoute, getWalkingRoute } from './routing.service.js';
import { ApiException } from '../../lib/errors/api-exception.js';

const router: Router = Router();

function parseCoords(query: Request['query']) {
  const oLat = parseFloat(query.originLat as string);
  const oLng = parseFloat(query.originLng as string);
  const dLat = parseFloat(query.destLat as string);
  const dLng = parseFloat(query.destLng as string);

  if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
    throw new ApiException(
      400,
      'VALIDATION_ERROR',
      'Query parameters originLat, originLng, destLat, and destLng must be valid numbers.'
    );
  }

  if (oLat < -90 || oLat > 90 || dLat < -90 || dLat > 90 || oLng < -180 || oLng > 180 || dLng < -180 || dLng > 180) {
    throw new ApiException(
      400,
      'VALIDATION_ERROR',
      'Coordinates out of range (latitude must be between -90 and 90, longitude between -180 and 180).'
    );
  }

  return { oLat, oLng, dLat, dLng };
}

// GET /api/routes/driving
router.get('/driving', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { oLat, oLng, dLat, dLng } = parseCoords(req.query);
    const route = await getDrivingRoute(oLat, oLng, dLat, dLng);
    return res.status(200).json(route);
  } catch (error) {
    return next(error);
  }
});

// GET /api/routes/walking
router.get('/walking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { oLat, oLng, dLat, dLng } = parseCoords(req.query);
    const route = await getWalkingRoute(oLat, oLng, dLat, dLng);
    return res.status(200).json(route);
  } catch (error) {
    return next(error);
  }
});

export default router;
