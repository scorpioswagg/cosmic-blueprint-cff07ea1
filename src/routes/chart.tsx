import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { calculateChart } from "@/utils/astrology/chart.functions";
import { supabase } from "@/integrations/supabase/client";
import { Starfield } from "@/components/Starfield";

export const Route = createFileRoute("/chart")({
  head: () => ({
    meta: [
      { title: "Birth Chart Calculator — Cosmic Blueprint" },
      {
        name: "description",
        content:
          "Enter your birth details to generate a precise Swiss Ephemeris birth chart. Optionally compare against FreeAstro.",
      },
    ],
  }),
  component: ChartPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

interface FormState {
  name: string;
  birthDate: string;
  birthTime: string;
  city: string;
  country: string;
  compareWithFreeAstro: boolean;
}

const initialState: FormState = {
  name: "",
  birthDate: "",
  birthTime: "",
  city: "",
  country: "",
  compareWithFreeAstro: false,
};

type CalcResult = Awaited<ReturnType<typeof calculateChart>>;

function ChartPage() {
  const navigate = useNavigate();
  const calc = useServerFn(calculateChart);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalcResult | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        navigate({ to: "/login" });
        return;
      }

      const r = await calc({
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          name: form.name.trim(),
          birthDate: form.birthDate,
          birthTime: form.birthTime,
          city: form.city.trim(),
          country: form.country.trim(),
          compareWithFreeAstro: form.compareWithFreeAstro,
        },
      });
      setResult(r);
      if (!r.ok) setError(r.error);
    } catch (err: unknown) {
      // requireSupabaseAuth throws a Response object (not an Error) on 401
      if (err instanceof Response) {
        if (err.status === 401 || err.status === 403) {
          navigate({ to: "/login" });
          return;
        }
        const body = await err.text().catch(() => "");
        setError(body || `Server error (${err.status})`);
      } else {
        const msg = (err as Error).message ?? String(err);
        if (/auth|unauthor|sign in|jwt|\[object Response\]/i.test(msg)) {
          navigate({ to: "/login" });
          return;
        }
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background px-4 py-12">
      <Starfield />
      <div className="relative z-10 mx-auto w-full max-w-3xl">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold text-foreground">
            Cosmic <span className="text-primary">Blueprint</span>
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-foreground sm:text-4xl">
            Generate Your Birth Chart
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Calculations use Swiss Ephemeris as the source of truth. Location coordinates and
            timezone are resolved automatically.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-10 space-y-6 rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm sm:p-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" htmlFor="name">
              <input
                id="name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={inputCls}
                placeholder="Kyle Merritt"
              />
            </Field>
            <Field label="Birth Date" htmlFor="birthDate">
              <input
                id="birthDate"
                type="date"
                required
                value={form.birthDate}
                onChange={(e) => update("birthDate", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Birth Time (24h, local)" htmlFor="birthTime">
              <input
                id="birthTime"
                type="time"
                required
                value={form.birthTime}
                onChange={(e) => update("birthTime", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="City" htmlFor="city">
              <input
                id="city"
                required
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className={inputCls}
                placeholder="Cincinnati"
              />
            </Field>
            <Field label="Country" htmlFor="country">
              <input
                id="country"
                required
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                className={inputCls}
                placeholder="USA"
              />
            </Field>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/40 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.compareWithFreeAstro}
              onChange={(e) => update("compareWithFreeAstro", e.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span className="text-sm">
              <span className="block font-medium text-foreground">
                Also fetch FreeAstro positions for comparison
              </span>
              <span className="block text-muted-foreground">
                FreeAstro values are stored separately and never replace Swiss Ephemeris. You'll see
                per-planet deltas.
              </span>
            </span>
          </label>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Calculating..." : "Calculate Chart"}
          </button>
        </form>

        {result?.ok && <ResultsPanel result={result} />}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function ResultsPanel({ result }: { result: Extract<CalcResult, { ok: true }> }) {
  const { sourceOfTruth, comparison, geocoding } = result;
  return (
    <div className="mt-8 space-y-6">
      {geocoding && (
        <div className="rounded-xl border border-border/40 bg-card/30 px-5 py-3 text-sm text-muted-foreground backdrop-blur-sm">
          <span className="font-medium text-foreground">Resolved location:</span>{" "}
          {geocoding.resolvedLocation} · {geocoding.latitude.toFixed(4)}°,{" "}
          {geocoding.longitude.toFixed(4)}° · {geocoding.timezone} (UTC
          {geocoding.timezoneOffset >= 0 ? "+" : ""}
          {geocoding.timezoneOffset})
        </div>
      )}

      <div className="rounded-2xl border border-primary/30 bg-card/50 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            Swiss Ephemeris (source of truth)
          </h2>
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
            engine: {sourceOfTruth.engine}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          JD {sourceOfTruth.julianDay ?? "—"} · Epoch {sourceOfTruth.epochUtc ?? "—"}
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {sourceOfTruth.planets.map((p) => (
            <li
              key={p.name}
              className="flex items-center justify-between rounded-md border border-border/40 bg-background/40 px-3 py-2 text-sm"
            >
              <span className="font-medium text-foreground">{p.name}</span>
              <span className="font-mono text-muted-foreground">{p.longitude.toFixed(4)}°</span>
            </li>
          ))}
        </ul>
      </div>

      {comparison && (
        <div className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">Comparison: FreeAstro</h2>
            <span className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
              comparison only
            </span>
          </div>
          {comparison.error ? (
            <p className="mt-3 text-sm text-destructive">{comparison.error}</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Max delta vs Swiss Ephemeris:{" "}
                <span className="font-mono text-foreground">
                  {comparison.maxDeltaDegrees.toFixed(4)}°
                </span>
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Planet</th>
                      <th className="pb-2 pr-4 font-medium">Swiss (truth)</th>
                      <th className="pb-2 pr-4 font-medium">FreeAstro</th>
                      <th className="pb-2 font-medium">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {comparison.deltas.map((d) => (
                      <tr key={d.planet}>
                        <td className="py-2 pr-4 font-medium text-foreground">{d.planet}</td>
                        <td className="py-2 pr-4 font-mono text-muted-foreground">
                          {d.expected.toFixed(4)}°
                        </td>
                        <td className="py-2 pr-4 font-mono text-muted-foreground">
                          {d.actual.toFixed(4)}°
                        </td>
                        <td
                          className={`py-2 font-mono ${Math.abs(d.deltaDegrees) > 0.5 ? "text-destructive" : "text-foreground"}`}
                        >
                          {d.deltaDegrees >= 0 ? "+" : ""}
                          {d.deltaDegrees.toFixed(4)}°
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
