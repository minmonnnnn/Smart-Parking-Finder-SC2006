import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { ApiException } from '../../lib/errors/index.js';
import { getWeather } from './weather.service.js';

const router: ExpressRouter = Router();

// GET /api/weather?lat&lng
router.get('/', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query['lat'] as string);
  const lng = parseFloat(req.query['lng'] as string);

  if (isNaN(lat) || isNaN(lng)) {
    throw new ApiException(400, 'VALIDATION_ERROR', 'lat and lng query params are required and must be numbers.');
  }

  try {
    const weather = await getWeather(lat, lng);
    return res.status(200).json(weather);
  } catch {
    throw new ApiException(503, 'EXTERNAL_SERVICE_UNAVAILABLE', 'Weather service is temporarily unavailable.');
  }
});

export default router;
