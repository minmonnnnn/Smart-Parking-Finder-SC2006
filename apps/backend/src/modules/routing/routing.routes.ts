import { Router, type Request, type Response } from 'express';
import { getDrivingRoute, getWalkingRoute } from './routing.service.js';

const router: Router = Router();

/**
 * GET /api/routes/driving
 * Query params: originLat, originLng, destLat, destLng
 * Returns DrivingRoute JSON per docs/API_CONTRACT.md
 */
router.get('/driving', async (req: Request, res: Response) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;

    const oLat = parseFloat(originLat as string);
    const oLng = parseFloat(originLng as string);
    const dLat = parseFloat(destLat as string);
    const dLng = parseFloat(destLng as string);

    if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
      return res.status(400).json({
        error: 'INVALID_QUERY_PARAMS',
        message: 'Query parameters originLat, originLng, destLat, and destLng must be valid numbers.',
      });
    }

    const route = await getDrivingRoute(oLat, oLng, dLat, dLng);
    return res.status(200).json(route);
  } catch (error) {
    console.error('Error handling /api/routes/driving:', error);
    return res.status(500).json({
      error: 'EXTERNAL_SERVICE_UNAVAILABLE',
      message: 'Failed to compute driving route. Please try again.',
    });
  }
});

/**
 * GET /api/routes/walking
 * Query params: originLat, originLng, destLat, destLng
 * Returns WalkingRoute JSON per docs/API_CONTRACT.md
 */
router.get('/walking', async (req: Request, res: Response) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;

    const oLat = parseFloat(originLat as string);
    const oLng = parseFloat(originLng as string);
    const dLat = parseFloat(destLat as string);
    const dLng = parseFloat(destLng as string);

    if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
      return res.status(400).json({
        error: 'INVALID_QUERY_PARAMS',
        message: 'Query parameters originLat, originLng, destLat, and destLng must be valid numbers.',
      });
    }

    const route = await getWalkingRoute(oLat, oLng, dLat, dLng);
    return res.status(200).json(route);
  } catch (error) {
    console.error('Error handling /api/routes/walking:', error);
    return res.status(500).json({
      error: 'EXTERNAL_SERVICE_UNAVAILABLE',
      message: 'Failed to compute walking route. Please try again.',
    });
  }
});

export default router;

