-- Base table for static HDB carpark information.
-- Run before 001_carpark_availability_cache.sql, which references this table.
-- This is a proposal for review; do not execute against a shared database until approved.

CREATE TABLE IF NOT EXISTS public.carparks (
  car_park_no TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL
    CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL
    CHECK (longitude BETWEEN -180 AND 180),
  -- HDB's source values must be normalised by the ingestion module.
  car_park_type TEXT NOT NULL
    CHECK (car_park_type IN ('Surface', 'Basement', 'Multi-storey', 'Covered')),
  -- Static HDB data may not contain these enriched values yet.
  total_lots INTEGER CHECK (total_lots >= 0),
  free_parking TEXT,
  night_parking TEXT,
  has_ev_charging BOOLEAN,
  parking_system TEXT
    CHECK (parking_system IN ('Electronic', 'Coupon')),
  postal_code TEXT,
  parking_cost NUMERIC CHECK (parking_cost >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carparks_coordinates
  ON public.carparks (latitude, longitude);

-- Static carpark facts are readable by drivers, but drivers cannot modify them.
ALTER TABLE public.carparks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.carparks FROM anon, authenticated;
GRANT SELECT ON TABLE public.carparks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.carparks TO service_role;

CREATE POLICY "Carparks are publicly readable"
  ON public.carparks
  FOR SELECT
  TO anon, authenticated
  USING (true);
