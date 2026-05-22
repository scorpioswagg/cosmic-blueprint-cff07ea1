import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateChartSwissOnly } from "@/utils/astrology/chart-swiss.functions";
import { generateReportContent } from "./generate-report.server";

/**
 * Public: fetch all active report products (no auth needed).
 */
export const getReportProducts = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data, error } = await supabase
      .from("report_products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  },
);

/**
 * Public: fetch one product by report_type.
 */
export const getReportProduct = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ reportType: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: product, error } = await supabase
      .from("report_products")
      .select("*")
      .eq("report_type", data.reportType)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return product;
  });

/**
 * Authenticated: check if the current user is an admin (free access).
 */
export const checkAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

/**
 * Authenticated: fetch the user's saved birth charts (for chart picker).
 */
export const getUserCharts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("birth_charts")
      .select("id, name, birth_date, birth_time, city, country, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Authenticated: fetch the user's reports with product names.
 */
export const getUserReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("reports")
      .select("id, report_type, status, storage_path, created_at, chart_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Authenticated: create a signed URL to download a report's PDF.
 */
export const getReportPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reportId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: report, error } = await supabase
      .from("reports")
      .select("storage_path, user_id, status")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error || !report) throw new Error("Report not found");
    if (report.user_id !== userId) throw new Error("Forbidden");
    if (!report.storage_path || report.status !== "completed") {
      throw new Error("Report not ready");
    }
    const { data: signed, error: signErr } = await supabase.storage
      .from("report-pdfs")
      .createSignedUrl(report.storage_path, 60 * 10);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Signing failed");
    return { url: signed.signedUrl };
  });

const PurchaseInput = z.object({
  reportType: z.string().min(1).max(64),
  // Either pick an existing chart, or supply birth details to create a new one.
  chartId: z.string().uuid().optional(),
  birth: z
    .object({
      name: z.string().min(1).max(120),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      birthTime: z.string().regex(/^\d{2}:\d{2}$/),
      city: z.string().min(1).max(120),
      country: z.string().min(1).max(120),
    })
    .optional(),
});

/**
 * Authenticated: start a report purchase.
 *   - Resolves (or creates) a chart for the user.
 *   - Creates a pending report row.
 *   - If user is admin: generates immediately and returns { kind: "ready", reportId }.
 *   - Else: creates a pending payment + Stripe Checkout Session, returns { kind: "checkout", url }.
 */
export const purchaseReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PurchaseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Resolve product
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: product, error: prodErr } = await (supabase as any)
      .from("report_products")
      .select("report_type, name, price_cents")
      .eq("report_type", data.reportType)
      .eq("is_active", true)
      .maybeSingle();
    if (prodErr || !product) throw new Error("Report type not available");

    // 2) Resolve chart
    let chartId = data.chartId;
    if (!chartId) {
      if (!data.birth) throw new Error("Provide a chart or birth details");
      // Server-fn calling server-fn (token already on context's supabase auth header).
      // Re-invoke via direct handler call:
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      // Easier: call the helper directly by re-issuing the chart calc via auth-context supabase.
      // But chart-swiss already handles geocode + Swiss Ephemeris and uses its own middleware,
      // so we forward by calling it as a function:
      const result = await calculateChartSwissOnly({
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        data: data.birth,
      } as unknown as { data: typeof data.birth });
      if (!result.ok) throw new Error(result.error);
      chartId = result.chartId;
    } else {
      // Verify chart belongs to user
      const { data: chart } = await supabase
        .from("birth_charts")
        .select("id")
        .eq("id", chartId)
        .maybeSingle();
      if (!chart) throw new Error("Chart not found");
    }

    // 3) Admin?
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    // 4) Create pending report row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: report, error: reportErr } = await (supabase as any)
      .from("reports")
      .insert({
        user_id: userId,
        chart_id: chartId,
        report_type: data.reportType,
        is_premium: !isAdmin,
        status: "pending",
      })
      .select("id")
      .single();
    if (reportErr || !report) throw new Error(reportErr?.message ?? "Failed to create report");

    if (isAdmin) {
      // Admin → generate immediately
      try {
        await generateReportContent(report.id);
        return { kind: "ready" as const, reportId: report.id };
      } catch (err) {
        return { kind: "ready" as const, reportId: report.id, error: (err as Error).message };
      }
    }

    // Non-admin → create Stripe Checkout Session
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new Error("Stripe is not configured");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: payment, error: payErr } = await (supabase as any)
      .from("payments")
      .insert({
        user_id: userId,
        report_id: report.id,
        amount_cents: product.price_cents,
        currency: "usd",
        status: "pending",
      })
      .select("id")
      .single();
    if (payErr || !payment) throw new Error(payErr?.message ?? "Failed to create payment");

    // Build absolute origin for success/cancel URLs
    const origin =
      // Vite/Worker env at runtime
      process.env.PUBLIC_SITE_URL ||
      // Fallback (good enough for dev/preview)
      "https://id-preview--a53a6e19-3363-4588-8f64-fc94973c96e8.lovable.app";

    const body = new URLSearchParams();
    body.append("mode", "payment");
    body.append("success_url", `${origin}/reports/success?session_id={CHECKOUT_SESSION_ID}`);
    body.append("cancel_url", `${origin}/reports`);
    body.append("client_reference_id", report.id);
    body.append("metadata[report_id]", report.id);
    body.append("metadata[payment_id]", payment.id);
    body.append("metadata[user_id]", userId);
    body.append("line_items[0][quantity]", "1");
    body.append("line_items[0][price_data][currency]", "usd");
    body.append("line_items[0][price_data][unit_amount]", String(product.price_cents));
    body.append("line_items[0][price_data][product_data][name]", product.name);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!stripeRes.ok) {
      const errText = await stripeRes.text().catch(() => "");
      throw new Error(`Stripe error: ${errText.slice(0, 200)}`);
    }

    const session = await stripeRes.json();
    // Persist stripe session id
    await supabase
      .from("payments")
      .update({ stripe_session_id: session.id })
      .eq("id", payment.id);

    return { kind: "checkout" as const, url: session.url as string };
  });
