create table public.favourite_locations (
  favourite_id serial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_name text not null check (length(trim(location_name)) > 0),
  address text not null check (length(trim(address)) > 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  unique (user_id, latitude, longitude)
);

alter table public.favourite_locations enable row level security;

create policy "Users can read their own favourite locations"
  on public.favourite_locations
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own favourite locations"
  on public.favourite_locations
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own favourite locations"
  on public.favourite_locations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own favourite locations"
  on public.favourite_locations
  for delete
  using (auth.uid() = user_id);
