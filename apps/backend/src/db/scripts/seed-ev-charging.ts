/**
 * Seeds has_ev_charging in the carparks table using:
 *   1. OneMap reverse geocode  (lat/lng → postal code)
 *   2. LTA DataMall EVChargingPoints  (postal code → charger locations)
 *   3. Haversine proximity check (charger within 50 m of carpark → true)
 *
 * Usage (from apps/backend/):
 *   npx tsx --env-file=.env src/db/scripts/seed-ev-charging.ts
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LTA_DATAMALL_API_KEY, ONEMAP_TOKEN
 */

import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LTA_DATAMALL_API_KEY, ONEMAP_TOKEN } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LTA_DATAMALL_API_KEY || !ONEMAP_TOKEN) {
  console.error('Missing one of: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LTA_DATAMALL_API_KEY, ONEMAP_TOKEN');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface DbCarpark {
  car_park_no: string;
  latitude: number;
  longitude: number;
}

interface EvStation {
  latitude: number;
  longitude: number;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getPostalCode(lat: number, lng: number): Promise<string | null> {
  const url = `https://www.onemap.gov.sg/api/public/revgeocode?location=${lat},${lng}&buffer=500&addressType=All&otherFeatures=N`;
  const res = await fetch(url, { headers: { Authorization: ONEMAP_TOKEN! } });
  if (!res.ok) return null;
  const data = await res.json() as { GeocodeInfo?: { POSTALCODE?: string }[] };
  const code = data.GeocodeInfo?.[0]?.POSTALCODE;
  return code && code !== 'NIL' ? code : null;
}

async function getEvChargers(postalCode: string): Promise<EvStation[]> {
  const url = `https://datamall2.mytransport.sg/ltaodataservice/EVChargingPoints?PostalCode=${postalCode}`;
  const res = await fetch(url, { headers: { AccountKey: LTA_DATAMALL_API_KEY!, accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json() as { value?: { evLocationsData?: EvStation[] } };
  return data.value?.evLocationsData ?? [];
}

async function main() {
  console.log('Loading carparks from DB…');
  const { data: carparks, error } = await supabase
    .from('carparks')
    .select('car_park_no, latitude, longitude');
  if (error) throw error;
  console.log(`  ${(carparks as DbCarpark[]).length} carparks loaded`);

  // Step 1: reverse geocode each carpark to get its postal code
  console.log('\nReverse geocoding carparks via OneMap…');
  const carparkPostalMap = new Map<string, string>(); // car_park_no → postal code
  const postalCodeSet = new Set<string>();

  for (let i = 0; i < (carparks as DbCarpark[]).length; i++) {
    const cp = (carparks as DbCarpark[])[i]!;
    const postal = await getPostalCode(cp.latitude, cp.longitude);
    if (postal) {
      carparkPostalMap.set(cp.car_park_no, postal);
      postalCodeSet.add(postal);
    }
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${(carparks as DbCarpark[]).length} done…`);
    await sleep(80); // stay under OneMap rate limit
  }
  console.log(`  Got postal codes for ${carparkPostalMap.size} carparks (${postalCodeSet.size} unique)`);

  // Step 2: fetch EV chargers for each unique postal code
  console.log('\nFetching EV chargers from LTA per postal code…');
  const postalChargerMap = new Map<string, EvStation[]>(); // postal code → chargers
  let totalChargers = 0;

  for (const postal of postalCodeSet) {
    const chargers = await getEvChargers(postal);
    if (chargers.length > 0) {
      postalChargerMap.set(postal, chargers);
      totalChargers += chargers.length;
    }
    await sleep(50);
  }
  console.log(`  Found ${totalChargers} EV chargers across ${postalChargerMap.size} postal codes`);

  // Step 3: match chargers to carparks within 50 m
  const RADIUS_METERS = 50;
  const evCarparks: string[] = [];

  for (const cp of carparks as DbCarpark[]) {
    const postal = carparkPostalMap.get(cp.car_park_no);
    if (!postal) continue;
    const chargers = postalChargerMap.get(postal) ?? [];
    const hasCharger = chargers.some((ch) =>
      distanceMeters(cp.latitude, cp.longitude, ch.latitude, ch.longitude) <= RADIUS_METERS,
    );
    if (hasCharger) evCarparks.push(cp.car_park_no);
  }

  console.log(`\n${evCarparks.length} carparks matched to EV chargers within ${RADIUS_METERS} m`);

  // Step 4: update DB
  const { error: resetErr } = await supabase
    .from('carparks')
    .update({ has_ev_charging: false })
    .neq('car_park_no', '');
  if (resetErr) throw resetErr;

  if (evCarparks.length > 0) {
    const { error: updateErr } = await supabase
      .from('carparks')
      .update({ has_ev_charging: true })
      .in('car_park_no', evCarparks);
    if (updateErr) throw updateErr;
  }

  console.log(`Done. ${evCarparks.length} carparks marked as hasEvCharging = true.`);
  if (evCarparks.length > 0) console.log('Matched:', evCarparks.join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
