create table if not exists public.project_site_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  plan_type text not null,
  map_url text,
  drone_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_site_plans_project_type_key unique (project_id, plan_type)
);

create index if not exists project_site_plans_project_id_idx on public.project_site_plans(project_id);

create or replace function public.set_project_site_plan_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_site_plans_updated_at on public.project_site_plans;
create trigger project_site_plans_updated_at before update on public.project_site_plans
for each row execute function public.set_project_site_plan_updated_at();

insert into public.project_site_plans (project_id, plan_type, map_url, drone_url)
select id, 'master_plan', nullif(site_plan_url, ''), nullif(drone_url, '')
from public.projects
on conflict (project_id, plan_type) do update
set map_url = coalesce(public.project_site_plans.map_url, excluded.map_url),
    drone_url = coalesce(public.project_site_plans.drone_url, excluded.drone_url);

insert into public.project_site_plans (project_id, plan_type, map_url, drone_url)
select project_id,
       'section_' || row_number() over (partition by project_id order by sort_order, created_at, id),
       master_plan_url,
       drone_url
from public.project_sections
on conflict (project_id, plan_type) do nothing;

create or replace function public.create_master_project_site_plan()
returns trigger language plpgsql as $$
begin
  insert into public.project_site_plans (project_id, plan_type)
  values (new.id, 'master_plan')
  on conflict (project_id, plan_type) do nothing;
  return new;
end;
$$;

drop trigger if exists projects_create_master_site_plan on public.projects;
create trigger projects_create_master_site_plan after insert on public.projects
for each row execute function public.create_master_project_site_plan();

alter table public.project_site_plans enable row level security;
drop policy if exists project_site_plans_public_read on public.project_site_plans;
create policy project_site_plans_public_read on public.project_site_plans for select using (true);

alter table public.projects drop column if exists site_plan_url;
alter table public.projects drop column if exists drone_url;
drop table if exists public.project_sections;
