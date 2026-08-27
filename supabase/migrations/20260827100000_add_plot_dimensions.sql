-- Add length, width dimensions and notes to plots table
ALTER TABLE public.plots
  ADD COLUMN IF NOT EXISTS length_m   numeric(8,2),
  ADD COLUMN IF NOT EXISTS width_m    numeric(8,2),
  ADD COLUMN IF NOT EXISTS notes      text;

-- Backfill area_sq_ft from area_sq_yards where missing
UPDATE public.plots
SET area_sq_ft = ROUND(area_sq_yards * 9, 2)
WHERE area_sq_ft IS NULL AND area_sq_yards IS NOT NULL;
