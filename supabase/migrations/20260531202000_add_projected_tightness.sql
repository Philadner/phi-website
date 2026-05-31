alter table public.dylan_tightness_samples
  add column if not exists projected_tightness numeric;

update public.dylan_tightness_samples
  set projected_tightness = tightness
  where projected_tightness is null;

alter table public.dylan_tightness_samples
  alter column projected_tightness set default 8,
  alter column projected_tightness set not null;

alter table public.phil_tightness_samples
  add column if not exists projected_tightness numeric;

update public.phil_tightness_samples
  set projected_tightness = tightness
  where projected_tightness is null;

alter table public.phil_tightness_samples
  alter column projected_tightness set default 8,
  alter column projected_tightness set not null;
