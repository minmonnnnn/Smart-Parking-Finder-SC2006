import { describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import routingRouter from './routing.routes.js';
import { ApiException } from '../../lib/errors/api-exception.js';

function createMockReqRes(query: Record<string, string>) {
  const req = { query } as unknown as Request;
  const jsonMock = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  const res = {
    status: statusMock,
    json: jsonMock,
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next, statusMock, jsonMock };
}

describe('routing.routes.ts unit tests', () => {
  // Helper to extract route handler from express router stack
  const drivingHandler = (routingRouter.stack.find((layer) => layer.route?.path === '/driving')?.route
    ?.stack[0]?.handle) as (req: Request, res: Response, next: NextFunction) => Promise<void>;

  const walkingHandler = (routingRouter.stack.find((layer) => layer.route?.path === '/walking')?.route
    ?.stack[0]?.handle) as (req: Request, res: Response, next: NextFunction) => Promise<void>;

  it('throws ApiException with VALIDATION_ERROR when query params are missing on /driving', async () => {
    const { req, res, next } = createMockReqRes({});
    await drivingHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiException));
    const error = vi.mocked(next).mock.calls[0]![0] as unknown as ApiException;
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toContain('must be valid numbers');
  });

  it('throws ApiException with VALIDATION_ERROR when coordinates are out of valid range', async () => {
    const { req, res, next } = createMockReqRes({
      originLat: '999',
      originLng: '103.8',
      destLat: '1.35',
      destLng: '103.85',
    });
    await drivingHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiException));
    const error = vi.mocked(next).mock.calls[0]![0] as unknown as ApiException;
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toContain('Coordinates out of range');
  });

  it('returns 200 with driving route when valid coordinates are passed', async () => {
    const { req, res, next, statusMock, jsonMock } = createMockReqRes({
      originLat: '1.3650',
      originLng: '103.8320',
      destLat: '1.3585',
      destLng: '103.8375',
    });
    await drivingHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distanceMeters: expect.any(Number),
        durationMinutes: expect.any(Number),
        trafficStatus: expect.stringMatching(/^(Light|Moderate|Heavy)$/),
      })
    );
  });

  it('returns 200 with walking route when valid coordinates are passed on /walking', async () => {
    const { req, res, next, statusMock, jsonMock } = createMockReqRes({
      originLat: '1.3585',
      originLng: '103.8375',
      destLat: '1.3520',
      destLng: '103.8360',
    });
    await walkingHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distanceMeters: expect.any(Number),
        durationMinutes: expect.any(Number),
      })
    );
  });
});
