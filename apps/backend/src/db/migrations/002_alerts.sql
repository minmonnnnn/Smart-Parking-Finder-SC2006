create table if not exists alerts (
  id serial primary key,
  user_id uuid not null references profiles(id),
  car_park_no text not null references carparks(car_park_no),
  last_known_status text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);