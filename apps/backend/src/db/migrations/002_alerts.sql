set search_path to public;

create table if not exists alerts (
  id serial primary key,
  user_id uuid not null references profiles(id),
  car_park_no text not null references carparks(car_park_no),
  last_known_status text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.alerts enable row level security;

revoke all on table public.alerts
  from anon, authenticated;

drop policy if exists "Anyone can read alerts"
  on public.alerts;

grant select, insert, update, delete
  on table public.alerts
  to service_role;

grant usage, select on sequence public.alerts_id_seq
  to service_role;