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
  on conflict on constraint dating_choice_totals_pkey
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
