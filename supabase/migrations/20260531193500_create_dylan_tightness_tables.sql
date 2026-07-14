create table if not exists public.dylan_tightness_samples (
  recorded_at timestamptz primary key default now(),
  steam_id text not null,
  persona_state integer not null,
  game_id text,
  game_name text,
  is_online boolean not null default false,
  is_apex boolean not null default false,
  is_elden boolean not null default false,
  tightness numeric not null
);

create index if not exists dylan_tightness_samples_recorded_at_idx
  on public.dylan_tightness_samples (recorded_at desc);

create index if not exists dylan_tightness_samples_activity_idx
  on public.dylan_tightness_samples (is_online, is_apex, is_elden, recorded_at desc);

create table if not exists public.dylan_tightness_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
