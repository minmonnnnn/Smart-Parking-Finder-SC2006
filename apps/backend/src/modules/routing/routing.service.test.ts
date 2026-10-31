import { describe, expect, it } from 'vitest';
import { calculateDistanceKm, classifyTraffic, getDrivingRoute, getWalkingRoute } from './routing.service.js';
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

describe('classifyTraffic', () => {
  const dummyOriginLat = 1.3500;
  const dummyOriginLng = 103.8300;
  const dummyDestLat = 1.3550;
  const dummyDestLng = 103.8350;

  it('classifies local short routes (< 3km) accurately based on estate driving speeds', async () => {
    // 1 km in 5 mins (12 km/h) -> Moderate (normal residential estate with traffic lights)
    const trafficNormal = await classifyTraffic(1.0, 5, dummyOriginLat, dummyOriginLng, dummyDestLat, dummyDestLng);
    expect(trafficNormal).toBe('Moderate');

    // 1 km in 3 mins (20 km/h) -> Light (smooth estate driving)
    const trafficSmooth = await classifyTraffic(1.0, 3, dummyOriginLat, dummyOriginLng, dummyDestLat, dummyDestLng);
    expect(trafficSmooth).toBe('Light');

    // 1 km in 10 mins (6 km/h) -> Heavy (crawling traffic jam)
    const trafficHeavy = await classifyTraffic(1.0, 10, dummyOriginLat, dummyOriginLng, dummyDestLat, dummyDestLng);
    expect(trafficHeavy).toBe('Heavy');
  });

  it('classifies traffic using delayRatio when Google Routes staticDuration is available', async () => {
    // delayRatio 1.05 (< 1.15) -> Light
    const lightDelay = await classifyTraffic(1.0, 5, dummyOriginLat, dummyOriginLng, dummyDestLat, dummyDestLng, 1.05);
    expect(lightDelay).toBe('Light');

    // delayRatio 1.25 (1.15 - 1.35) -> Moderate
    const moderateDelay = await classifyTraffic(1.0, 5, dummyOriginLat, dummyOriginLng, dummyDestLat, dummyDestLng, 1.25);
    expect(moderateDelay).toBe('Moderate');

    // delayRatio 1.50 (> 1.35) -> Heavy
    const heavyDelay = await classifyTraffic(1.0, 5, dummyOriginLat, dummyOriginLng, dummyDestLat, dummyDestLng, 1.50);
    expect(heavyDelay).toBe('Heavy');
  });

  it('classifies longer routes (>= 3km) using arterial/highway thresholds', async () => {
    // 10 km in 12 mins (50 km/h) -> Light
    const lightHwy = await classifyTraffic(10.0, 12, dummyOriginLat, dummyOriginLng, dummyDestLat, dummyDestLng);
    expect(lightHwy).toBe('Light');

    // 10 km in 20 mins (30 km/h) -> Moderate
    const modHwy = await classifyTraffic(10.0, 20, dummyOriginLat, dummyOriginLng, dummyDestLat, dummyDestLng);
    expect(modHwy).toBe('Moderate');

    // 10 km in 40 mins (15 km/h) -> Heavy
    const heavyHwy = await classifyTraffic(10.0, 40, dummyOriginLat, dummyOriginLng, dummyDestLat, dummyDestLng);
    expect(heavyHwy).toBe('Heavy');
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

