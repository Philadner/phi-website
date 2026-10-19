begin;

-- These thresholds match the shared website policy. NULL/malformed scores fail closed.
create or replace function public.phrase_passes_hard_exclusions(result jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(bool_and(
    case when jsonb_typeof(result->'category_scores'->policy.category) = 'number'
      then (result->'category_scores'->>policy.category)::numeric >= 0
        and (result->'category_scores'->>policy.category)::numeric < policy.threshold
      else false
    end
  ), false)
  from (values
    ('sexual/minors', 0.2::numeric),
    ('violence/graphic', 0.4::numeric),
    ('illicit/violent', 0.3::numeric),
    ('self-harm/instructions', 0.2::numeric)
  ) as policy(category, threshold);
$$;
revoke all on function public.phrase_passes_hard_exclusions(jsonb) from public, anon, authenticated;
grant execute on function public.phrase_passes_hard_exclusions(jsonb) to service_role;

delete from public.phrases where not public.phrase_passes_hard_exclusions(hatefulness);
alter table public.phrases add constraint phrases_hard_exclusions
  check (public.phrase_passes_hard_exclusions(hatefulness));

notify pgrst, 'reload schema';
commit;
