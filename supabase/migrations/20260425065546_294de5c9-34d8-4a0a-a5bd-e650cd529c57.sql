ALTER TABLE public.birth_charts
  ADD COLUMN IF NOT EXISTS comparison_positions jsonb,
  ADD COLUMN IF NOT EXISTS calculation_source text;