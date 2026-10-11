create table if not exists carpark_availability_cache (
  car_park_no text primary key references carparks(car_park_no),
  available_lots integer not null,
  total_lots integer not null,
  status text not null check (
    status in ('High', 'Moderate', 'Low', 'Unavailable')
  ),
  fetched_at timestamptz not null
);