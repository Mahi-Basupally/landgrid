create table if not exists public.project_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  master_plan_url text,
  drone_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name)
);

create index if not exists project_sections_project_id_idx on public.project_sections(project_id, sort_order);

alter table public.project_sections enable row level security;

create or replace function public.set_project_sections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_sections_updated_at on public.project_sections;
create trigger project_sections_updated_at
before update on public.project_sections
for each row execute function public.set_project_sections_updated_at();
