alter table public.project_site_plans
  add column if not exists display_name text;

alter table public.project_site_plans
  add column if not exists geometry text;

update public.project_site_plans
set display_name = case
  when plan_type = 'master_plan' then 'Master Plan'
  when plan_type ~ '^section_[0-9]+$' then 'Section ' || substring(plan_type from 'section_([0-9]+)')
  else plan_type
end
where display_name is null;
