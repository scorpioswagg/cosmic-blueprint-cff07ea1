import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getReportProduct,
  getUserCharts,
  purchaseReport,
  checkAdminAccess,
} from "@/utils/reports/reports.functions";
import { supabase } from "@/integrations/supabase/client";
import { Starfield } from "@/components/Starfield";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/reports/$reportType")({
  component: ReportPurchasePage,
});

interface SavedChart {
  id: string;
  name: string;
  birth_date: string;
  birth_time: string;
  city: string;
  country: string;
}

interface Product {
  report_type: string;
  name: string;
  tagline: string;
  description: string;
  price_cents: number;
  page_estimate: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function ReportPurchasePage() {
  const { reportType } = Route.useParams();
  const navigate = useNavigate();
  const fetchProduct = useServerFn(getReportProduct);
  const fetchCharts = useServerFn(getUserCharts);
  const fetchAdmin = useServerFn(checkAdminAccess);
  const purchase = useServerFn(purchaseReport);

  const [product, setProduct] = useState<Product | null>(null);
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"saved" | "new">("saved");
  const [chartId, setChartId] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    birthDate: "",
    birthTime: "",
    city: "",
    country: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProduct({ data: { reportType } }).then((p) => {
      setProduct(p as Product | null);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setIsSignedIn(false);
        setLoading(false);
        return;
      }
      setIsSignedIn(true);
      const token = data.session.access_token;
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [c, a] = await Promise.all([
          fetchCharts({ headers }),
          fetchAdmin({ headers }),
        ]);
        const list = c as SavedChart[];
        setCharts(list);
        setIsAdmin(a.isAdmin);
        if (list.length > 0) {
          setChartId(list[0].id);
        } else {
          setMode("new");
        }
      } finally {
        setLoading(false);
      }
    });
  }, [reportType]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd.session?.access_token;
      if (!token) {
        navigate({ to: "/login" });
        return;
      }
      const payload: {
        reportType: string;
        chartId?: string;
        birth?: typeof form;
      } = { reportType };
      if (mode === "saved") {
        if (!chartId) throw new Error("Please pick a chart.");
        payload.chartId = chartId;
      } else {
        if (!form.name || !form.birthDate || !form.birthTime || !form.city || !form.country) {
          throw new Error("Please fill in all birth details.");
        }
        payload.birth = form;
      }
      const result = await purchase({
        headers: { Authorization: `Bearer ${token}` },
        data: payload,
      });
      if (result.kind === "checkout") {
        window.location.href = result.url;
      } else {
        navigate({
          to: "/reports/success",
          search: { report_id: result.reportId } as never,
        });
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background">
      <Starfield />
      <Header />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link
          to="/reports"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All reports
        </Link>

        {loading || !product ? (
          <div className="mt-8 h-64 animate-pulse rounded-2xl border border-border/30 bg-card/30" />
        ) : (
          <>
            <div className="mt-6">
              <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
                {product.name}
              </h1>
              <p className="mt-2 text-sm italic text-accent">{product.tagline}</p>
              <p className="mt-3 text-muted-foreground">{product.description}</p>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <span className="rounded-full bg-background/60 px-3 py-1 text-muted-foreground">
                  {product.page_estimate}
                </span>
                <span className="text-2xl font-bold text-primary">
                  {isAdmin ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`}
                </span>
                {isAdmin && (
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
                    Admin
                  </span>
                )}
              </div>
            </div>

            {isSignedIn === false ? (
              <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
                <p className="font-semibold text-foreground">Sign in to continue</p>
                <Link
                  to="/login"
                  className="mt-4 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Sign In / Sign Up
                </Link>
              </div>
            ) : (
              <form
                onSubmit={onSubmit}
                className="mt-8 space-y-6 rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm"
              >
                <fieldset className="space-y-2">
                  <legend className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Birth data source
                  </legend>
                  <label className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/40 p-4 transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "saved"}
                      disabled={charts.length === 0}
                      onChange={() => setMode("saved")}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">
                      <span className="block font-medium text-foreground">
                        Use a saved chart
                      </span>
                      <span className="block text-muted-foreground">
                        {charts.length === 0
                          ? "No saved charts yet."
                          : `Pick from ${charts.length} saved chart${charts.length === 1 ? "" : "s"}.`}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/40 p-4 transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "new"}
                      onChange={() => setMode("new")}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">
                      <span className="block font-medium text-foreground">
                        Enter new birth details
                      </span>
                      <span className="block text-muted-foreground">
                        Calculate a fresh chart for this report.
                      </span>
                    </span>
                  </label>
                </fieldset>

                {mode === "saved" && charts.length > 0 && (
                  <div className="space-y-1.5">
                    <label htmlFor="chart" className="block text-xs font-medium text-muted-foreground">
                      Saved chart
                    </label>
                    <select
                      id="chart"
                      value={chartId}
                      onChange={(e) => setChartId(e.target.value)}
                      className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {charts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.birth_date} {c.birth_time} ({c.city}, {c.country})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {mode === "new" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="Full Name" id="name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                    <TextField label="Birth Date" id="birthDate" type="date" max={today()} value={form.birthDate} onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))} />
                    <TextField label="Birth Time (24h)" id="birthTime" type="time" value={form.birthTime} onChange={(v) => setForm((f) => ({ ...f, birthTime: v }))} />
                    <TextField label="City" id="city" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
                    <TextField label="Country" id="country" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
                  </div>
                )}

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
                  {submitting
                    ? "Working..."
                    : isAdmin
                      ? "Generate Report (Free)"
                      : `Continue to Checkout — $${(product.price_cents / 100).toFixed(2)}`}
                </button>
              </form>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function TextField({
  label,
  id,
  value,
  onChange,
  type = "text",
  max,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  max?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
