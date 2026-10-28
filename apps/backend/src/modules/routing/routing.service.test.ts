import { describe, expect, it } from 'vitest';
import { calculateDistanceKm, getDrivingRoute, getWalkingRoute } from './routing.service.js';
import { hasNearbyIncidents, type LtaTrafficIncident } from './lta-traffic.service.js';

describe('calculateDistanceKm', () => {
  it('returns 0 for identical points', () => {
    expect(calculateDistanceKm(1.35, 103.82, 1.35, 103.82)).toBe(0);
  });

  it('calculates approximately ~2.3 km between Ang Mo Kio and Bishan', () => {
    const dist = calculateDistanceKm(1.3650, 103.8320, 1.3506, 103.8488);
    expect(dist).toBeGreaterThan(2.0);
    expect(dist).toBeLessThan(3.0);
  });

  it('calculates correct distance between Marina Bay Sands and Orchard Road (~3.5km)', () => {
    const dist = calculateDistanceKm(1.2834, 103.8607, 1.3048, 103.8318);
    expect(dist).toBeGreaterThan(3.0);
    expect(dist).toBeLessThan(5.0);
  });
});

describe('hasNearbyIncidents', () => {
  const originLat = 1.3500;
  const originLng = 103.8300;
  const destLat = 1.3600;
  const destLng = 103.8400;

  it('returns false when incidents list is empty', () => {
    expect(hasNearbyIncidents([], originLat, originLng, destLat, destLng)).toBe(false);
  });

  it('returns true when an incident is near the midpoint', () => {
    const incidents: LtaTrafficIncident[] = [
      {
        Type: 'Accident',
        Latitude: 1.3550,
        Longitude: 103.8350,
        Message: 'Accident on central road',
      },
    ];
    expect(hasNearbyIncidents(incidents, originLat, originLng, destLat, destLng)).toBe(true);
  });

  it('returns false when incidents are far away in Tuas', () => {
    const incidents: LtaTrafficIncident[] = [
      {
        Type: 'Heavy Traffic',
        Latitude: 1.3200,
        Longitude: 103.6500,
        Message: 'Heavy traffic at Tuas',
      },
    ];
    expect(hasNearbyIncidents(incidents, originLat, originLng, destLat, destLng)).toBe(false);
  });
});

describe('getDrivingRoute fallback', () => {
  it('computes an estimated driving route when external service is mocked to fail', async () => {
    const route = await getDrivingRoute(1.3650, 103.8320, 1.3585, 103.8375);
    expect(route).toBeDefined();
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.durationMinutes).toBeGreaterThanOrEqual(1);
    expect(['Light', 'Moderate', 'Heavy']).toContain(route.trafficStatus);
    expect(route.summary).toBe('Fastest Route (Estimated)');
  });
});

describe('getWalkingRoute fallback', () => {
  it('computes an estimated walking route using 75m/min baseline', async () => {
    const route = await getWalkingRoute(1.3585, 103.8375, 1.3520, 103.8360);
    expect(route).toBeDefined();
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.durationMinutes).toBeGreaterThanOrEqual(1);
    // ~720 meters at 75m/min is ~10 mins
    expect(route.durationMinutes).toBeGreaterThanOrEqual(5);
  });
});

