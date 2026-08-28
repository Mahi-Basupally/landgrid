-- Drop the legacy owner text column from plots — owner_id FK to project_owners is the source of truth
ALTER TABLE public.plots DROP COLUMN IF EXISTS owner;

-- Helpful view: plots with resolved owner name
CREATE OR REPLACE VIEW public.plots_with_owner AS
SELECT
  p.*,
  po.name  AS owner_name,
  po.email AS owner_email,
  po.phone AS owner_phone
FROM public.plots p
LEFT JOIN public.project_owners po ON po.id = p.owner_id;
