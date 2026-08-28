-- Create project_owners table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.project_owners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_owners_project_id_idx ON public.project_owners(project_id);

-- Enable RLS
ALTER TABLE public.project_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "project_owners_service" ON public.project_owners USING (true) WITH CHECK (true);

-- Add owner_id foreign key to plots if not exists
ALTER TABLE public.plots
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.project_owners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS plots_owner_id_idx ON public.plots(owner_id);
