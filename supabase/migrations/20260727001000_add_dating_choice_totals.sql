create table if not exists public.dating_choice_totals (
  question_key text not null,
  option_key text not null,
  votes bigint not null default 0 check (votes >= 0),
  updated_at timestamptz not null default now(),
  primary key (question_key, option_key),
  check (char_length(question_key) between 1 and 80),
  check (char_length(option_key) between 1 and 40)
);

alter table public.dating_choice_totals enable row level security;

revoke all on table public.dating_choice_totals from anon, authenticated;

create or replace function public.record_dating_choice(
  p_question_key text,
  p_option_key text
)
returns table (
  option_key text,
  votes bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(p_question_key) not between 1 and 80 then
    raise exception 'Invalid question key';
  end if;

  if char_length(p_option_key) not between 1 and 40 then
    raise exception 'Invalid option key';
  end if;

  insert into public.dating_choice_totals (question_key, option_key, votes)
  values (p_question_key, p_option_key, 1)
  on conflict (question_key, option_key)
  do update set
    votes = public.dating_choice_totals.votes + 1,
    updated_at = now();

  return query
    select totals.option_key, totals.votes
    from public.dating_choice_totals as totals
    where totals.question_key = p_question_key
    order by totals.option_key;
end;
$$;

revoke all on function public.record_dating_choice(text, text) from public, anon, authenticated;
grant execute on function public.record_dating_choice(text, text) to service_role;
