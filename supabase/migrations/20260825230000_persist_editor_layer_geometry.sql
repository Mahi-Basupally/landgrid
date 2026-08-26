alter table public.project_site_plans add column if not exists layer_geometry jsonb not null default '{}'::jsonb;
