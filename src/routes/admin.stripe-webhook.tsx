import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStripeWebhookStatus } from "@/utils/reports/stripe-health.functions";
import { supabase } from "@/integrations/supabase/client";
import { Starfield } from "@/components/Starfield";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin/stripe-webhook")({
  head: () => ({
    meta: [{ title: "Stripe Webhook Health — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: StripeWebhookHealthPage,
});

type StatusResult = Awaited<ReturnType<typeof getStripeWebhookStatus>>;

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
        ok ? "bg-green-500/15 text-green-500" : "bg-destructive/15 text-destructive"
      }`}
    >
      {label}
    </span>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function StripeWebhookHealthPage() {
  const fetchStatus = useServerFn(getStripeWebhookStatus);
  const [authState, setAuthState] = useState<"checking" | "denied" | "ok">("checking");
  const [data, setData] = useState<StatusResult | null>(null);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthState("denied");
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setAuthState(role ? "ok" : "denied");
    })();
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchStatus();
      setData(r);
      if (!r.ok) setError(r.error ?? "Unknown error");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authState === "ok") void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  const pingHealth = async () => {
    if (!data?.ok) return;
    setPingResult(null);
    try {
      const res = await fetch(data.config.webhookUrl, { method: "GET" });
      const body = await res.text();
      setPingResult(`HTTP ${res.status} — ${body.slice(0, 300)}`);
    } catch (e) {
      setPingResult(`Failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Starfield />
      <Header />
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-16">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold">Stripe Webhook Health</h1>
          <p className="mt-2 text-muted-foreground">
            Verifies the webhook signing secret and recent <code>checkout.session.completed</code> traffic.
          </p>
        </div>

        {authState === "checking" && <p className="text-muted-foreground">Checking access…</p>}

        {authState === "denied" && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Admin access required</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in as an admin to view webhook diagnostics.
            </p>
            <Link to="/login" className="mt-4 inline-block text-sm underline">Sign in</Link>
          </Card>
        )}

        {authState === "ok" && (
          <>
            <div className="mb-6 flex gap-3">
              <Button onClick={refresh} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </Button>
              <Button variant="secondary" onClick={pingHealth} disabled={!data?.ok}>
                Ping health endpoint
              </Button>
            </div>

            {error && (
              <Card className="mb-6 border-destructive p-4 text-destructive">{error}</Card>
            )}

            {data?.ok && (
              <>
                <Card className="mb-6 p-6">
                  <h2 className="text-lg font-semibold">Configuration</h2>
                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Signing secret</span>
                      <Badge
                        ok={data.config.signingSecretConfigured}
                        label={data.config.signingSecretConfigured ? "Configured" : "MISSING"}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Stripe API key</span>
                      <Badge
                        ok={data.config.stripeSecretConfigured}
                        label={data.config.stripeSecretConfigured ? "Configured" : "MISSING"}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-muted-foreground">Webhook URL</div>
                      <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">
                        {data.config.webhookUrl}
                      </code>
                    </div>
                    <div className="sm:col-span-2 text-muted-foreground">
                      Expected event: <code>{data.config.expectedEvent}</code>
                    </div>
                  </div>
                  {pingResult && (
                    <p className="mt-4 rounded bg-muted px-3 py-2 font-mono text-xs">{pingResult}</p>
                  )}
                </Card>

                <Card className="mb-6 p-6">
                  <h2 className="text-lg font-semibold">Recent activity</h2>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-2xl font-bold">{data.totals.total}</div>
                      <div className="text-muted-foreground">total (last 25)</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-500">{data.totals.verified}</div>
                      <div className="text-muted-foreground">verified</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-destructive">{data.totals.invalid}</div>
                      <div className="text-muted-foreground">invalid sig</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data.totals.checkoutCompleted}</div>
                      <div className="text-muted-foreground">checkout.completed</div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3 text-sm">
                    <div>
                      <div className="font-medium">Last verified checkout.session.completed</div>
                      {data.lastVerifiedCheckout ? (
                        <div className="mt-1 rounded bg-muted px-3 py-2 font-mono text-xs">
                          {formatTime(data.lastVerifiedCheckout.received_at)} ·{" "}
                          {data.lastVerifiedCheckout.stripe_event_id ?? "(no id)"}
                        </div>
                      ) : (
                        <p className="mt-1 text-muted-foreground">
                          None yet. Complete a test checkout to verify end-to-end delivery.
                        </p>
                      )}
                    </div>
                    {data.lastInvalidSignature && (
                      <div>
                        <div className="font-medium text-destructive">
                          Last invalid-signature attempt
                        </div>
                        <div className="mt-1 rounded bg-destructive/10 px-3 py-2 font-mono text-xs">
                          {formatTime(data.lastInvalidSignature.received_at)} ·{" "}
                          {data.lastInvalidSignature.error ?? ""}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold">Event log</h2>
                  {data.events.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No webhook traffic recorded yet.
                    </p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="py-2 pr-4 font-medium">Received</th>
                            <th className="py-2 pr-4 font-medium">Type</th>
                            <th className="py-2 pr-4 font-medium">Sig</th>
                            <th className="py-2 pr-4 font-medium">Status</th>
                            <th className="py-2 pr-4 font-medium">Event ID</th>
                            <th className="py-2 pr-4 font-medium">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.events.map((e) => (
                            <tr key={e.id} className="border-b border-border/50 align-top">
                              <td className="py-2 pr-4 font-mono text-xs">
                                {formatTime(e.received_at)}
                              </td>
                              <td className="py-2 pr-4 font-mono text-xs">{e.event_type ?? "—"}</td>
                              <td className="py-2 pr-4">
                                <Badge ok={e.signature_verified} label={e.signature_verified ? "✓" : "✗"} />
                              </td>
                              <td className="py-2 pr-4 font-mono text-xs">{e.status_code}</td>
                              <td className="py-2 pr-4 font-mono text-xs">
                                {e.stripe_event_id ?? "—"}
                              </td>
                              <td className="py-2 pr-4 text-xs text-destructive">{e.error ?? ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
