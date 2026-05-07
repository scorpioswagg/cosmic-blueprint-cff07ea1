
-- Add 9 new report types
ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'solar_return';
ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'lunar_return';
ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'progressed';
ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'career_vocation';
ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'relocation';
ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'child_profile';
ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'past_life_karma';
ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'health_wellness';
ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'financial_abundance';

-- Create a product catalog table
CREATE TABLE public.report_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type report_type NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 999,
  page_estimate TEXT NOT NULL DEFAULT '30-50 pages',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active report products"
  ON public.report_products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage report products"
  ON public.report_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
