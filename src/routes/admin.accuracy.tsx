import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runSwissAccuracyTest } from "@/utils/astrology/accuracy-swiss.functions";
import { supabase } from "@/integrations/supabase/client";
import { Starfield } from "@/components/Starfield";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin/accuracy")({
  head: () => ({
    meta: [{ title: "Accuracy Test — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AccuracyPage,
});

type RunResult = Awaited<ReturnType<typeof runSwissAccuracyTest>>;

function formatDeg(d: number | null | undefined) {
  if (d == null || !Number.isFinite(d)) return "—";
  return `${d.toFixed(4)}°`;
}

function AccuracyPage() {
  const runTest = useServerFn(runSwissAccuracyTest);
  const [authState, setAuthState] = useState<"checking" | "denied" | "ok">("checking");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthState("denied");
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setAuthState(data ? "ok" : "denied");
    })();
  }, []);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await runTest();
      setResult(r);
      if (!r.ok) setError(r.error ?? "Unknown error");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Starfield />
      <Header />
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-16">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold">Swiss Ephemeris Accuracy Test</h1>
          <p className="mt-2 text-muted-foreground">
            Recalculates the Kyle Merritt reference chart via pyswisseph and diffs each
            planet against the expected ecliptic longitude.
          </p>
        </div>

        {authState === "checking" && (
          <p className="text-muted-foreground">Checking access…</p>
        )}

        {authState === "denied" && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Admin access required</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You must be signed in as an admin to run the accuracy test.
            </p>
            <Link to="/login" className="mt-4 inline-block text-sm underline">
              Sign in
            </Link>
          </Card>
        )}

        {authState === "ok" && (
          <>
            <Button onClick={handleRun} disabled={loading}>
              {loading ? "Running…" : "Run accuracy test"}
            </Button>

            {error && (
              <Card className="mt-6 border-destructive p-4 text-destructive">
                {error}
              </Card>
            )}

            {result && result.ok && (
              <Card className="mt-6 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`rounded-md px-3 py-1 text-sm font-semibold ${
                      result.passed
                        ? "bg-green-500/15 text-green-500"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {result.passed ? "PASSED" : "FAILED"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    tolerance ±{result.toleranceDegrees}° · max Δ {formatDeg(result.maxDeltaDegrees)} ·{" "}
                    {result.durationMs}ms
                  </span>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <div><span className="font-medium text-foreground">Benchmark:</span> {result.benchmarkName}</div>
                  <div><span className="font-medium text-foreground">Engine:</span> {result.ephemerisEngine}</div>
                  <div><span className="font-medium text-foreground">Julian Day:</span> {result.julianDay ?? "—"}</div>
                  <div><span className="font-medium text-foreground">Epoch UTC:</span> {result.epochUtc ?? "—"}</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-4 font-medium">Planet</th>
                        <th className="py-2 pr-4 font-medium">Expected</th>
                        <th className="py-2 pr-4 font-medium">Actual</th>
                        <th className="py-2 pr-4 font-medium">Δ (signed)</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.deltas.map((d) => (
                        <tr key={d.planet} className="border-b border-border/50">
                          <td className="py-2 pr-4 font-medium">{d.planet}</td>
                          <td className="py-2 pr-4 font-mono">{formatDeg(d.expected)}</td>
                          <td className="py-2 pr-4 font-mono">{formatDeg(d.actual)}</td>
                          <td
                            className={`py-2 pr-4 font-mono ${
                              d.withinTolerance ? "" : "text-destructive"
                            }`}
                          >
                            {formatDeg(d.deltaDegrees)}
                          </td>
                          <td className="py-2 pr-4">
                            {d.withinTolerance ? (
                              <span className="text-green-500">✓ OK</span>
                            ) : (
                              <span className="text-destructive">✗ OUT</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {result.failedPlanets.length > 0 && (
                  <p className="mt-4 text-sm text-destructive">
                    Failed planets: {result.failedPlanets.join(", ")}
                  </p>
                )}
              </Card>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
