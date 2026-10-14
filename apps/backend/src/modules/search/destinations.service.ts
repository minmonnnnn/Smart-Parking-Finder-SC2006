/**
 * Destination search & resolve — owner: Min
 * Thin proxies to Google Places API (New).
 * FR3–FR6
 */

import type { Destination } from '@smart-parking/shared-types';

export interface DestinationSuggestion {
  placeId: string;
  name: string;
  address: string;
}

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set');
  return key;
}

// GET /api/destinations/search?query=<text>  FR3–FR4
export async function searchDestinations(query: string): Promise<DestinationSuggestion[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
    },
    body: JSON.stringify({
      input: query,
      locationBias: {
        circle: {
          // Centred on Singapore
          center: { latitude: 1.3521, longitude: 103.8198 },
          radius: 50000,
        },
      },
      includedRegionCodes: ['sg'],
    }),
  });

  if (!res.ok) throw new Error('Google Places autocomplete failed');

  const json = await res.json();
  const suggestions = json?.suggestions ?? [];

  return suggestions
    .filter((s: { placePrediction?: unknown }) => s.placePrediction)
    .map((s: { placePrediction: { placeId: string; text: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }) => ({
      placeId: s.placePrediction.placeId,
      name: s.placePrediction.structuredFormat?.mainText?.text ?? s.placePrediction.text.text,
      address: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
    }));
}

// GET /api/destinations/:placeId/resolve  FR5–FR6
export async function resolveDestination(placeId: string): Promise<Destination | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=id,displayName,formattedAddress,location`,
    {
      headers: {
        'X-Goog-Api-Key': apiKey(),
      },
    },
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Google Places details failed');

  const place = await res.json();

  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
  };
}
