/**
 * Ingestion script: HDB carpark fixture → Supabase carparks table
 *
 * Reads hdb_carparks_real_10.json (already SVY21-converted and field-mapped),
 * then upserts each record into public.carparks.
 *
 * Usage:
 *   pnpm --filter backend tsx src/db/scripts/ingest-carparks.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (service_role is needed; anon key is read-only on this table).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface HdbFixtureRecord {
  car_park_no: string;
  address: string;
  latitude: number;
  longitude: number;
  car_park_type: 'Surface' | 'Basement' | 'Multi-storey' | 'Covered';
  parking_system: 'Electronic' | 'Coupon';
  free_parking: string;
  night_parking: string;
  car_park_decks: number;
  gantry_height: number;
}

async function ingest() {
  const fixturePath = join(__dirname, '../fixtures/hdb_carparks_real_10.json');
  const raw: HdbFixtureRecord[] = JSON.parse(readFileSync(fixturePath, 'utf-8'));

  const rows = raw.map((r) => ({
    car_park_no: r.car_park_no,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    car_park_type: r.car_park_type,
    parking_system: r.parking_system,
    free_parking: r.free_parking,
    night_parking: r.night_parking,
    has_ev_charging: false,
  }));

  console.log(`Upserting ${rows.length} carparks...`);

  const { error } = await supabase
    .from('carparks')
    .upsert(rows, { onConflict: 'car_park_no' });

  if (error) {
    console.error('Upsert failed:', error.message);
    process.exit(1);
  }

  console.log(`Done. ${rows.length} carparks ingested.`);
}

ingest();
