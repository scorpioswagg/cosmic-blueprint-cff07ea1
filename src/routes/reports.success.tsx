import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getUserReports, getReportPdfUrl } from "@/utils/reports/reports.functions";
import { supabase } from "@/integrations/supabase/client";
import { Starfield } from "@/components/Starfield";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/reports/success")({
  validateSearch: (search: Record<string, unknown>) => ({
    report_id: typeof search.report_id === "string" ? search.report_id : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: SuccessPage,
});

interface ReportRow {
  id: string;
  report_type: string;
  status: string;
  storage_path: string | null;
  created_at: string;
}

function SuccessPage() {
  const fetchReports = useServerFn(getUserReports);
  const fetchPdfUrl = useServerFn(getReportPdfUrl);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    const list = await fetchReports({ headers: { Authorization: `Bearer ${token}` } });
    setReports(list as ReportRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Poll while any report is pending (webhook may still be running)
    const id = setInterval(() => {
      load();
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const handleDownload = async (reportId: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const { url } = await fetchPdfUrl({
      headers: { Authorization: `Bearer ${token}` },
      data: { reportId },
    });
    window.open(url, "_blank");
  };

  return (
    <div className="relative min-h-screen bg-background">
      <Starfield />
      <Header />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Your Reports
          </h1>
          <p className="mt-2 text-muted-foreground">
            Reports generate in the background. This page refreshes automatically.
          </p>
        </div>

        {loading ? (
          <div className="mt-10 h-40 animate-pulse rounded-2xl border border-border/30 bg-card/30" />
        ) : reports.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">
            No reports yet. <Link to="/reports" className="text-primary underline">Browse reports →</Link>
          </p>
        ) : (
          <ul className="mt-10 space-y-3">
            {reports.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm"
              >
                <div>
                  <p className="font-medium text-foreground capitalize">
                    {r.report_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · {r.status}
                  </p>
                </div>
                {r.status === "completed" && r.storage_path ? (
                  <button
                    onClick={() => handleDownload(r.id)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    Download PDF
                  </button>
                ) : r.status === "failed" ? (
                  <span className="text-sm text-destructive">Failed</span>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    Generating…
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 text-center">
          <Link to="/reports" className="text-sm text-primary hover:underline">
            ← Back to all reports
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
