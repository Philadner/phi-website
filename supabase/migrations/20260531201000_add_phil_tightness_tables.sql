alter table public.dylan_tightness_samples
  add column if not exists is_game boolean not null default false;

update public.dylan_tightness_samples
  set is_game = game_id is not null
  where is_game = false and game_id is not null;

create index if not exists dylan_tightness_samples_game_idx
  on public.dylan_tightness_samples (is_game, recorded_at desc);

create table if not exists public.phil_tightness_samples (
  recorded_at timestamptz primary key default now(),
  steam_id text not null,
  persona_state integer not null,
  game_id text,
  game_name text,
  is_online boolean not null default false,
  is_game boolean not null default false,
  is_nubby boolean not null default false,
  is_spicy boolean not null default false,
  is_celeste boolean not null default false,
  tightness numeric not null
);

create index if not exists phil_tightness_samples_recorded_at_idx
  on public.phil_tightness_samples (recorded_at desc);

create index if not exists phil_tightness_samples_activity_idx
  on public.phil_tightness_samples (is_online, is_game, is_nubby, is_spicy, is_celeste, recorded_at desc);

create table if not exists public.phil_tightness_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
