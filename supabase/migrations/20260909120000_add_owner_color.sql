-- Persist a user-selected highlight color for each project owner.
ALTER TABLE public.project_owners
  ADD COLUMN IF NOT EXISTS color text;

-- Keep colors as standard 6-digit hex values when supplied.
ALTER TABLE public.project_owners
  DROP CONSTRAINT IF EXISTS project_owners_color_hex_check;

ALTER TABLE public.project_owners
  ADD CONSTRAINT project_owners_color_hex_check
  CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');
