begin;
alter table public.phrases add column if not exists school_safety jsonb;
alter table public.phrases add constraint phrases_school_safety_shape check (
  school_safety is null or coalesce(
    jsonb_typeof(school_safety) = 'object'
    and jsonb_typeof(school_safety->'school_safe') = 'boolean'
    and jsonb_typeof(school_safety->'reason') = 'string'
    and length(school_safety->>'reason') <= 240
    and school_safety->>'model' = 'gpt-6-luna'
    and jsonb_typeof(school_safety->'prompt_version') = 'number'
    and jsonb_typeof(school_safety->'reviewed_at') = 'string', false)
);
notify pgrst, 'reload schema';
commit;
