begin;
create table if not exists public.phrases (
  id bigint generated always as identity primary key,
  text text not null check (char_length(btrim(text)) between 1 and 10000),
  text_hash text generated always as (md5(text)) stored unique,
  hatefulness jsonb not null check (
    jsonb_typeof(hatefulness) = 'object'
    and jsonb_typeof(hatefulness -> 'category_scores') = 'object'
    and jsonb_typeof(hatefulness -> 'categories') = 'object'
    and jsonb_typeof(hatefulness -> 'flagged') = 'boolean'
  ),
  created_at timestamptz not null default now()
);
alter table public.phrases enable row level security;
revoke all on public.phrases from anon, authenticated;
grant select, insert on public.phrases to service_role;
grant usage, select on sequence public.phrases_id_seq to service_role;
create table if not exists public.phrase_submission_limits (
  client_hash text primary key, window_started_at timestamptz not null, attempts integer not null
);
alter table public.phrase_submission_limits enable row level security;
revoke all on public.phrase_submission_limits from anon, authenticated;
create or replace function public.claim_phrase_submission(client_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare attempt_count integer;
begin
  if client_hash is null or client_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  delete from public.phrase_submission_limits where window_started_at < now() - interval '1 day';
  insert into public.phrase_submission_limits as limits (client_hash, window_started_at, attempts)
  values (client_hash, now(), 1)
  on conflict on constraint phrase_submission_limits_pkey do update set
    attempts = case when limits.window_started_at < now() - interval '5 minutes' then 1 else limits.attempts + 1 end,
    window_started_at = case when limits.window_started_at < now() - interval '5 minutes' then now() else limits.window_started_at end
  returning attempts into attempt_count;
  return attempt_count <= 6;
end;
$$;
revoke all on function public.claim_phrase_submission(text) from public, anon, authenticated;
grant execute on function public.claim_phrase_submission(text) to service_role;
notify pgrst, 'reload schema';
commit;
