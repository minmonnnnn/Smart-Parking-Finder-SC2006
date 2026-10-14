import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL('./000_carparks.sql', import.meta.url)
const migrationSql = readFileSync(migrationUrl, 'utf8')
const sql = migrationSql.toLowerCase()

describe('carparks migration', () => {
  it('creates the carparks table with its required columns', () => {
    expect(sql).toContain('create table if not exists public.carparks')
    expect(sql).toMatch(/car_park_no\s+text\s+primary key/)

    for (const column of [
      'address', 'latitude', 'longitude', 'car_park_type', 'total_lots',
      'free_parking', 'night_parking', 'has_ev_charging', 'parking_system',
      'postal_code', 'parking_cost', 'updated_at',
    ]) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\s+`))
    }
  })

  it('allows unavailable enrichment values to remain unknown', () => {
    expect(sql).toMatch(/total_lots\s+integer\s+check/)
    expect(sql).toMatch(/has_ev_charging\s+boolean/)
    expect(sql).toMatch(/parking_cost\s+numeric\s+check/)
  })

  it('enables read-only public access', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toMatch(/revoke all on table public\.carparks from anon, authenticated/)
    expect(sql).toMatch(/grant select on table public\.carparks to anon, authenticated/)
    expect(sql).toMatch(/for select\s+to anon, authenticated\s+using\s*\(true\)/)
  })
})
