/**
 * Weather service — owner: Moufooza
 * Wraps the data.gov.sg NEA 2-hour nowcast API.
 * FR24–FR27, UC-05
 */

import type { WeatherInfo } from '@smart-parking/shared-types';

// Forecasts containing these substrings are considered rain events (FR26).
const RAIN_KEYWORDS = ['rain', 'shower', 'thunder', 'drizzle'];

function isRainy(forecast: string): boolean {
  const lower = forecast.toLowerCase();
  return RAIN_KEYWORDS.some((kw) => lower.includes(kw));
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface AreaForecast {
  area: string;
  forecast: string;
}

interface AreaMetadata {
  name: string;
  label_location: { latitude: number; longitude: number };
}

export async function getWeather(lat: number, lng: number): Promise<WeatherInfo> {
  const retrievedAt = new Date().toISOString();

  const res = await fetch(
    'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast',
  );

  if (!res.ok) throw new Error('NEA weather API unavailable');

  const json = await res.json();

  const items: AreaForecast[] = json?.data?.items?.[0]?.forecasts ?? [];
  const metadata: AreaMetadata[] = json?.data?.area_metadata ?? [];

  if (items.length === 0) throw new Error('No forecast data returned');

  // Find the forecast area closest to the given coordinates
  let nearest = items[0]!;
  let minDist = Infinity;

  for (const item of items) {
    const meta = metadata.find((m) => m.name === item.area);
    if (!meta) continue;
    const d = distanceKm(lat, lng, meta.label_location.latitude, meta.label_location.longitude);
    if (d < minDist) {
      minDist = d;
      nearest = item;
    }
  }

  const condition = nearest.forecast;
  const rainExpected = isRainy(condition);

  return {
    condition,
    rainExpected,
    forecastSummary: rainExpected
      ? `Rain expected near your destination — sheltered carparks recommended`
      : `No rain expected — ${condition}`,
    retrievedAt,
  };
}
