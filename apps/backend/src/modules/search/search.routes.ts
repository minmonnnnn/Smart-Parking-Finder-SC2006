import { Router, type Request, type Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiException } from '../../lib/errors/index.js';
import { getNearbyCarparks, getCarparkDetails } from './search.service.js';
import type { CarparkFilters, CarparkSort } from '@smart-parking/shared-types';

export function createSearchRouter(adminClient: SupabaseClient): Router {
  const router = Router();

  // GET /api/carparks/nearby
  router.get('/carparks/nearby', async (req: Request, res: Response) => {
    const { destinationLat, destinationLng, originLat, originLng, sort, vehicleType, ...rest } = req.query;

    const dLat = parseFloat(destinationLat as string);
    const dLng = parseFloat(destinationLng as string);
    if (isNaN(dLat) || isNaN(dLng)) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'destinationLat and destinationLng are required and must be numbers.');
    }

    const oLat = originLat !== undefined ? parseFloat(originLat as string) : undefined;
    const oLng = originLng !== undefined ? parseFloat(originLng as string) : undefined;
    if ((oLat === undefined) !== (oLng === undefined)) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'originLat and originLng must both be provided or both omitted.');
    }
    if (oLat !== undefined && (isNaN(oLat) || isNaN(oLng!))) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'originLat and originLng must be valid numbers.');
    }

    const sortParam = (sort as string | undefined);
    if (sortParam !== undefined && sortParam !== 'distance' && sortParam !== 'recommended') {
      throw new ApiException(400, 'VALIDATION_ERROR', "sort must be 'distance' or 'recommended'.");
    }

    const filters: CarparkFilters = {};
    if (rest.evChargingOnly === 'true') filters.evChargingOnly = true;
    if (rest.shelteredOnly === 'true') filters.shelteredOnly = true;
    if (rest.maxCost !== undefined) {
      const cost = parseFloat(rest.maxCost as string);
      if (!isNaN(cost)) filters.maxCost = cost;
    }
    if (rest.minAvailability === 'High' || rest.minAvailability === 'Moderate' || rest.minAvailability === 'Low') {
      filters.minAvailability = rest.minAvailability;
    }

    try {
      const result = await getNearbyCarparks(adminClient, {
        destinationLat: dLat,
        destinationLng: dLng,
        ...(oLat !== undefined && oLng !== undefined ? { originLat: oLat, originLng: oLng } : {}),
        ...(sortParam !== undefined ? { sort: sortParam as CarparkSort } : {}),
        filters,
      });

      if (result.carparks.length === 0) {
        throw new ApiException(404, 'NO_CARPARKS_FOUND', 'No carparks found near this destination.');
      }

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof ApiException) throw err;
      if (err instanceof Error && err.message === 'EXTERNAL_SERVICE_UNAVAILABLE') {
        throw new ApiException(503, 'EXTERNAL_SERVICE_UNAVAILABLE', 'Carpark data is temporarily unavailable.');
      }
      throw err;
    }
  });

  // GET /api/carparks/:carParkNo
  router.get('/carparks/:carParkNo', async (req: Request, res: Response) => {
    const carParkNo = req.params['carParkNo'] as string;
    const details = await getCarparkDetails(adminClient, carParkNo);
    if (!details) {
      throw new ApiException(404, 'NOT_FOUND', `Carpark ${carParkNo} not found.`);
    }
    return res.status(200).json(details);
  });

  return router;
}
