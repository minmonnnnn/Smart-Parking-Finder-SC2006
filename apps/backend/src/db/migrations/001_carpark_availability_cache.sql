set search_path to public;

create table if not exists carpark_availability_cache (
  car_park_no text primary key references carparks(car_park_no),
  available_lots integer not null,
  total_lots integer not null,
  status text not null check (
    status in ('High', 'Moderate', 'Low', 'Unavailable')
  ),
  fetched_at timestamptz not null
);

alter table public.carpark_availability_cache
  enable row level security;

revoke all on table public.carpark_availability_cache
  from anon, authenticated;

drop policy if exists "Anyone can read carpark availability"
  on public.carpark_availability_cache;

grant select, insert, update, delete
  on table public.carpark_availability_cache
  to service_role;