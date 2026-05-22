
-- 1) Storage bucket for generated report PDFs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-pdfs', 'report-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Users can read their own report files (path prefix = user_id/...)
CREATE POLICY "Users can read own report pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'report-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can read all report files
CREATE POLICY "Admins can read all report pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'report-pdfs'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2) Allow owners to update their own reports (server-side fill-in)
CREATE POLICY "Users can update own reports"
ON public.reports FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) Payments: allow users to insert/update their own payment rows
CREATE POLICY "Users can insert own payments"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments"
ON public.payments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4) Grant admin role to Kyle
INSERT INTO public.user_roles (user_id, role)
VALUES ('f7649207-b353-4467-b018-873ae1a6060c', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;
