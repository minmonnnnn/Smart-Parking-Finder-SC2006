import { describe, expect, it } from 'vitest';
import {
  RoutingContext,
  GoogleRoutesStrategy,
  GeometricFallbackStrategy,
  type IRoutingStrategy,
  type RouteCoordinates,
} from './routing.service.js';

describe('Routing Strategy Pattern (SC2006)', () => {
  const coords: RouteCoordinates = {
    originLat: 1.3650,
    originLng: 103.8320,
    destLat: 1.3506,
    destLng: 103.8488,
  };

  it('instantiates GoogleRoutesStrategy with correct strategy identifier', () => {
    const strategy = new GoogleRoutesStrategy();
    expect(strategy.strategyName).toBe('GoogleRoutes');
  });

  it('instantiates GeometricFallbackStrategy with correct strategy identifier', () => {
    const strategy = new GeometricFallbackStrategy();
    expect(strategy.strategyName).toBe('GeometricFallback');
  });

  it('computes driving route offline using GeometricFallbackStrategy', async () => {
    const strategy = new GeometricFallbackStrategy();
    const route = await strategy.computeDrivingRoute(coords);

    expect(route).toBeDefined();
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.durationMinutes).toBeGreaterThan(0);
    expect(['Light', 'Moderate', 'Heavy']).toContain(route.trafficStatus);
    expect(route.summary).toBe('Fastest Route (Estimated)');
  });

  it('computes walking route offline using GeometricFallbackStrategy', async () => {
    const strategy = new GeometricFallbackStrategy();
    const route = await strategy.computeWalkingRoute(coords);

    expect(route).toBeDefined();
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.durationMinutes).toBeGreaterThan(0);
  });

  it('swaps active strategy at runtime in RoutingContext', () => {
    const context = new RoutingContext(new GoogleRoutesStrategy());
    expect(context.getStrategy().strategyName).toBe('GoogleRoutes');

    const fallback = new GeometricFallbackStrategy();
    context.setStrategy(fallback);
    expect(context.getStrategy().strategyName).toBe('GeometricFallback');
  });

  it('automatically falls back to GeometricFallbackStrategy when primary strategy throws', async () => {
    // Mock a failing strategy (e.g. Google API down or quota exhausted)
    const failingStrategy: IRoutingStrategy = {
      strategyName: 'FailingProvider',
      computeDrivingRoute: async () => {
        throw new Error('API Quota Exceeded (429)');
      },
      computeWalkingRoute: async () => {
        throw new Error('API Quota Exceeded (429)');
      },
    };

    const context = new RoutingContext(failingStrategy, new GeometricFallbackStrategy());
    const route = await context.calculateDrivingRoute(coords);

    expect(route).toBeDefined();
    expect(route.summary).toBe('Fastest Route (Estimated)');
    expect(route.distanceMeters).toBeGreaterThan(0);
  });
});

