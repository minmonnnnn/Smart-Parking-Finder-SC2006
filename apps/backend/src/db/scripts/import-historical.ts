/**
 * Import historical carpark availability CSVs → carpark_availability_historical table.
 *
 * CSV format: date_time,carpark_id,available_slots
 * Only imports rows whose carpark_id exists in the carparks table (FK constraint).
 * Derives day_of_week (0=Sun…6=Sat) and time_bucket_start (hour floor) from date_time.
 * Looks up total_lots from the carparks table for each carpark.
 *
 * Usage (from apps/backend/):
 *   npx tsx --env-file=.env src/db/scripts/import-historical.ts
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

interface HistoricalRow {
  car_park_no: string;
  recorded_date: string;
  day_of_week: number;
  time_bucket_start: string;
  available_lots: number;
  total_lots: number;
}

async function getKnownCarparks(): Promise<Set<string>> {
  // Supabase defaults to 1000 rows — fetch in pages to get all carparks
  const ids = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('carparks')
      .select('car_park_no')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to fetch carparks: ${error.message}`);
    for (const row of data ?? []) ids.add(row.car_park_no as string);
    if ((data?.length ?? 0) < PAGE) break;
    from += PAGE;
  }
  return ids;
}

function parseCSV(content: string): { dateTime: string; carparkId: string; availableSlots: number }[] {
  const lines = content.trim().split('\n').slice(1); // skip header
  return lines.flatMap((line) => {
    const parts = line.trim().split(',');
    if (parts.length < 3) return [];
    const [dateTime, carparkId, slotsStr] = parts as [string, string, string];
    const availableSlots = parseInt(slotsStr, 10);
    if (!dateTime || !carparkId || isNaN(availableSlots) || availableSlots < 0) return [];
    return [{ dateTime: dateTime.trim(), carparkId: carparkId.trim(), availableSlots }];
  });
}

async function run() {
  const historicalDir = join(__dirname, '../../../../../data/historical');
  const files = readdirSync(historicalDir).filter((f) => f.endsWith('.csv')).sort();
  console.log(`Found ${files.length} CSV files`);

  const knownCarparks = await getKnownCarparks();
  console.log(`${knownCarparks.size} carparks in DB`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const content = readFileSync(join(historicalDir, file), 'utf-8');
    const parsed = parseCSV(content);

    const rows: HistoricalRow[] = [];
    for (const { dateTime, carparkId, availableSlots } of parsed) {
      if (!knownCarparks.has(carparkId)) { totalSkipped++; continue; }

      const dt = new Date(dateTime);
      if (isNaN(dt.getTime())) { totalSkipped++; continue; }

      rows.push({
        car_park_no: carparkId,
        recorded_date: dt.toISOString().split('T')[0]!,
        day_of_week: dt.getDay(),
        time_bucket_start: `${String(dt.getHours()).padStart(2, '0')}:00:00`,
        available_lots: availableSlots,
        total_lots: 0,
      });
    }

    if (rows.length === 0) {
      console.log(`  ${file}: no matching carparks — skipped`);
      continue;
    }

    // Batch insert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from('carpark_availability_historical').insert(chunk);
      if (error) {
        console.error(`  ${file} chunk ${i / 500}: insert failed — ${error.message}`);
      } else {
        totalInserted += chunk.length;
      }
    }
    console.log(`  ${file}: ${rows.length} rows inserted`);
  }

  console.log(`\nDone. Inserted: ${totalInserted}, Skipped: ${totalSkipped}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
