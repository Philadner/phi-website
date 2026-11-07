begin;
create table public.news_articles (
  id text primary key default gen_random_uuid()::text,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  author text check (author is null or char_length(author) <= 60),
  "createdAt" timestamptz not null default now(),
  hatefulness jsonb not null check (public.phrase_passes_hard_exclusions(hatefulness)),
  school_safety jsonb,
  constraint news_moderation_shape check (coalesce(
    jsonb_typeof(hatefulness->'flagged') = 'boolean'
    and jsonb_typeof(hatefulness->'categories') = 'object'
    and jsonb_typeof(hatefulness->'category_scores') = 'object', false))
);
alter table public.news_articles enable row level security;
revoke all on public.news_articles from anon, authenticated;
grant select, insert, update on public.news_articles to service_role;
notify pgrst, 'reload schema';
commit;
