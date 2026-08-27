-- Store the canvas coordinate space and native image dimensions per site plan.
-- canvas_width / canvas_height: the SVG coordinate space plots were drawn in.
-- image_width  / image_height:  the native pixel dimensions of the uploaded image.
ALTER TABLE public.project_site_plans
  ADD COLUMN IF NOT EXISTS canvas_width  integer,
  ADD COLUMN IF NOT EXISTS canvas_height integer,
  ADD COLUMN IF NOT EXISTS image_width   integer,
  ADD COLUMN IF NOT EXISTS image_height  integer;

-- Back-fill existing rows with the default editor canvas size.
UPDATE public.project_site_plans
SET canvas_width = 1600, canvas_height = 1000
WHERE canvas_width IS NULL;
