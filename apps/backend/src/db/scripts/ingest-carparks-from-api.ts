/**
 * Fetches HDB Carpark Information from data.gov.sg, cross-references with
 * the carpark IDs present in data/historical/*.csv, and upserts matching
 * carparks into the Supabase carparks table.
 *
 * Run this to populate the carparks table with IDs that actually appear in
 * the historical data, so the historical import script finds matches.
 *
 * Usage (from apps/backend/):
 *   npx tsx --env-file=.env src/db/scripts/ingest-carparks-from-api.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// SVY21 → WGS84 (inverse Transverse Mercator on WGS84 ellipsoid, EPSG:3414)
function svy21ToWgs84(easting: number, northing: number): { latitude: number; longitude: number } {
  const a = 6378137.0, f = 1 / 298.257223563;
  const b = a * (1 - f), e2 = (a * a - b * b) / (a * a);
  const lat0 = (1 + 22 / 60) * Math.PI / 180;
  const lon0 = (103 + 50 / 60) * Math.PI / 180;
  const E0 = 28001.642, N0 = 38744.572;

  function meridianArc(phi: number) {
    const e4 = e2 * e2, e6 = e4 * e2;
    return a * ((1 - e2/4 - 3*e4/64 - 5*e6/256)*phi - (3*e2/8 + 3*e4/32 + 45*e6/1024)*Math.sin(2*phi)
      + (15*e4/256 + 45*e6/1024)*Math.sin(4*phi) - (35*e6/3072)*Math.sin(6*phi));
  }

  const M0 = meridianArc(lat0);
  const E = easting - E0, N = northing - N0;
  const M1 = M0 + N;
  const mu = M1 / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 = mu + (3*e1/2 - 27*e1**3/32)*Math.sin(2*mu) + (21*e1**2/16 - 55*e1**4/32)*Math.sin(4*mu)
    + (151*e1**3/96)*Math.sin(6*mu) + (1097*e1**4/512)*Math.sin(8*mu);

  const sinP = Math.sin(phi1), cosP = Math.cos(phi1), tanP = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2*sinP*sinP);
  const R1 = a*(1-e2) / Math.pow(1 - e2*sinP*sinP, 1.5);
  const T1 = tanP*tanP, C1 = (e2/(1-e2))*cosP*cosP, D = E/N1;

  const lat = phi1 - (N1*tanP/R1)*(D**2/2 - (5+3*T1+10*C1-4*C1**2-9*(e2/(1-e2)))*D**4/24
    + (61+90*T1+298*C1+45*T1**2-252*(e2/(1-e2))-3*C1**2)*D**6/720);
  const lon = lon0 + (D - (1+2*T1+C1)*D**3/6 + (5-2*C1+28*T1-3*C1**2+8*(e2/(1-e2))+24*T1**2)*D**5/120) / cosP;

  return { latitude: parseFloat((lat*180/Math.PI).toFixed(6)), longitude: parseFloat((lon*180/Math.PI).toFixed(6)) };
}

function mapType(raw: string): string | null {
  const u = raw.toUpperCase();
  if (u.includes('BASEMENT')) return 'Basement';
  if (u.includes('MULTI')) return 'Multi-storey';
  if (u.includes('COVERED')) return 'Covered';
  if (u.includes('SURFACE')) return 'Surface';
  return null;
}

function mapParking(raw: string): string {
  return raw.toUpperCase().includes('COUPON') ? 'Coupon' : 'Electronic';
}

async function getHistoricalIds(): Promise<Set<string>> {
  const dir = join(__dirname, '../../../../../data/historical');
  const files = readdirSync(dir).filter(f => f.endsWith('.csv'));
  const ids = new Set<string>();
  for (const f of files) {
    const lines = readFileSync(join(dir, f), 'utf-8').trim().split('\n').slice(1);
    for (const line of lines) {
      const id = line.split(',')[1]?.trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

interface HdbRecord {
  car_park_no: string;
  address: string;
  x_coord: string;
  y_coord: string;
  car_park_type: string;
  type_of_parking_system: string;
  free_parking: string;
  night_parking: string;
  short_term_parking: string;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url: string, retries = 4): Promise<{ records: HdbRecord[]; total: number }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 429) {
      const wait = 2000 * (attempt + 1);
      console.log(`  rate-limited, retrying in ${wait}ms...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json() as Record<string, unknown>;
    const result = (json['data'] as Record<string, unknown>)?.['result'] ?? json['result'];
    const r = result as { records?: HdbRecord[]; total?: number } | undefined;
    return { records: r?.records ?? [], total: r?.total ?? 0 };
  }
  throw new Error('429 persisted after retries');
}

async function fetchHdbCarparks(): Promise<HdbRecord[]> {
  // CKAN API with known HDB Carpark Information resource ID
  const makeUrl = (offset: number, limit: number) =>
    `https://data.gov.sg/api/action/datastore_search?resource_id=139a3035-e624-4f56-b63f-89ae28d4ae4c&limit=${limit}&offset=${offset}`;

  const LIMIT = 500;
  const DELAY_MS = 1200; // stay well under rate limit

  const first = await fetchPage(makeUrl(0, LIMIT));
  if (first.records.length === 0) throw new Error('CKAN API returned 0 records on first page');
  const all = [...first.records];
  const total = first.total || first.records.length;
  console.log(`  total carparks reported: ${total}`);

  for (let offset = LIMIT; offset < total; offset += LIMIT) {
    await sleep(DELAY_MS);
    const page = await fetchPage(makeUrl(offset, LIMIT));
    all.push(...page.records);
    process.stdout.write(`  fetched ${all.length}/${total}\r`);
  }
  console.log(`\n  fetched ${all.length} records total`);
  return all;
}

async function run() {
  console.log('Reading historical carpark IDs from CSVs...');
  const historicalIds = await getHistoricalIds();
  console.log(`${historicalIds.size} unique carpark IDs in historical data`);

  console.log('Fetching HDB carpark info from data.gov.sg...');
  const records = await fetchHdbCarparks();
  console.log(`${records.length} carparks fetched from API`);

  const matching = records.filter(r => historicalIds.has(r.car_park_no));
  console.log(`${matching.length} carparks match historical IDs`);

  if (matching.length === 0) {
    console.error('No matches found — check that the data.gov.sg API returned data');
    process.exit(1);
  }

  const rows = matching.flatMap(r => {
    const type = mapType(r.car_park_type);
    if (!type) return [];
    const x = parseFloat(r.x_coord), y = parseFloat(r.y_coord);
    if (isNaN(x) || isNaN(y) || x === 0 || y === 0) return [];
    const { latitude, longitude } = svy21ToWgs84(x, y);
    return [{
      car_park_no: r.car_park_no,
      address: r.address,
      latitude,
      longitude,
      car_park_type: type,
      parking_system: mapParking(r.type_of_parking_system),
      free_parking: r.free_parking || null,
      night_parking: r.night_parking || 'NO',
      has_ev_charging: false,
    }];
  });

  console.log(`Upserting ${rows.length} carparks...`);
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from('carparks').upsert(chunk, { onConflict: 'car_park_no' });
    if (error) console.error(`Chunk ${i/200} failed: ${error.message}`);
    else process.stdout.write('.');
  }
  console.log(`\nDone. ${rows.length} carparks upserted.`);
}

run().catch(err => { console.error(err); process.exit(1); });
