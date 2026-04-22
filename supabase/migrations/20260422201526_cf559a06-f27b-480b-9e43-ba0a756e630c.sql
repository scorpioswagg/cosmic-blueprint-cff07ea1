
DROP POLICY "Anyone can insert email signup" ON public.email_signups;
CREATE POLICY "Anyone can insert email signup" ON public.email_signups
  FOR INSERT
  WITH CHECK (email IS NOT NULL AND length(trim(email)) > 5 AND email ~ '^[^@]+@[^@]+\.[^@]+$');
