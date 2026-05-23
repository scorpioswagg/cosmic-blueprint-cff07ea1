CREATE TABLE public.stripe_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  stripe_event_id text,
  event_type text,
  signature_verified boolean NOT NULL DEFAULT false,
  status_code integer NOT NULL,
  error text,
  raw_summary jsonb
);

CREATE INDEX stripe_webhook_events_received_at_idx
  ON public.stripe_webhook_events (received_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
  ON public.stripe_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));