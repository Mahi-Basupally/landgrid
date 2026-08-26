-- Ensure plot_number is unique per project.
-- Existing duplicates (if any) are deduplicated by keeping the most recently
-- inserted row (highest ctid) before the constraint is applied.

-- 1. Remove duplicate plot_number rows within the same project, keeping the latest.
DELETE FROM public.plots
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY project_id, plot_number
             ORDER BY created_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM public.plots
  ) ranked
  WHERE rn > 1
);

-- 2. Add the unique constraint.
ALTER TABLE public.plots
  ADD CONSTRAINT plots_project_id_plot_number_key UNIQUE (project_id, plot_number);
