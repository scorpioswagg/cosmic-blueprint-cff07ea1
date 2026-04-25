CREATE TABLE public.accuracy_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  passed boolean NOT NULL,
  tolerance_degrees double precision NOT NULL,
  benchmark_name text NOT NULL,
  ephemeris_engine text,
  ephemeris_config jsonb,
  julian_day double precision,
  epoch_utc timestamptz,
  expected_positions jsonb,
  actual_positions jsonb,
  deltas jsonb,
  max_delta_degrees double precision,
  failed_planets text[],
  raw_response jsonb,
  error_message text,
  duration_ms integer
);

ALTER TABLE public.accuracy_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view accuracy test runs"
ON public.accuracy_test_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_accuracy_test_runs_created_at ON public.accuracy_test_runs (created_at DESC);
CREATE INDEX idx_accuracy_test_runs_passed ON public.accuracy_test_runs (passed, created_at DESC);