-- Historical availability data imported from data/historical/*.csv
-- Used by Nigel's recommendation engine (FR45, UC-16) to compute day-of-week/hour availability ratios.
-- Run after 000_carparks.sql (references carparks.car_park_no).

CREATE TABLE IF NOT EXISTS public.carpark_availability_historical (
  id              BIGSERIAL PRIMARY KEY,
  car_park_no     TEXT NOT NULL REFERENCES public.carparks(car_park_no),
  -- ISO date of the original reading, e.g. "2025-01-01"
  recorded_date   DATE NOT NULL,
  -- 0 = Sunday … 6 = Saturday (matches JS Date.getDay())
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- Hour bucket start, e.g. "08:00:00" — groups all readings within the same hour
  time_bucket_start TIME NOT NULL,
  available_lots  INTEGER NOT NULL CHECK (available_lots >= 0),
  total_lots      INTEGER NOT NULL CHECK (total_lots > 0)
);

CREATE INDEX IF NOT EXISTS idx_hist_lookup
  ON public.carpark_availability_historical (car_park_no, day_of_week, time_bucket_start);

ALTER TABLE public.carpark_availability_historical ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.carpark_availability_historical FROM anon, authenticated;
GRANT SELECT ON TABLE public.carpark_availability_historical TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.carpark_availability_historical TO service_role;

CREATE POLICY "Historical data is publicly readable"
  ON public.carpark_availability_historical
  FOR SELECT TO anon, authenticated
  USING (true);
