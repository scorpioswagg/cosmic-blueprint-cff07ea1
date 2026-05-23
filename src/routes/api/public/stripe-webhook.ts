// Stripe webhook endpoint. Verifies the signature, marks the payment as paid,
// triggers report generation, and logs every received attempt for the admin
// health page.
//
// Configure in Stripe Dashboard → Webhooks with the event
//   - checkout.session.completed
// pointed at this route. STRIPE_WEBHOOK_SECRET is the signing secret.
//
// GET /api/public/stripe-webhook  -> health check (no secret value leaked)
// POST /api/public/stripe-webhook -> Stripe event ingestion
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateReportContent } from "@/utils/reports/generate-report.server";

function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0) return false;

  const signed = `${t}.${payload}`;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  for (const sig of sigs) {
    try {
      const a = Buffer.from(sig, "hex");
      const b = Buffer.from(expected, "hex");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      // ignore malformed signature
    }
  }
  return false;
}

async function logWebhookEvent(entry: {
  stripe_event_id: string | null;
  event_type: string | null;
  signature_verified: boolean;
  status_code: number;
  error: string | null;
  raw_summary: Record<string, unknown> | null;
}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("stripe_webhook_events").insert(entry);
  } catch (e) {
    console.error("[stripe-webhook] log insert failed:", (e as Error).message);
  }
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      GET: async () => {
        const configured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
        return Response.json({
          ok: true,
          endpoint: "/api/public/stripe-webhook",
          signing_secret_configured: configured,
          expected_event: "checkout.session.completed",
          time: new Date().toISOString(),
        });
      },
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const payload = await request.text();
        const sig = request.headers.get("stripe-signature");

        if (!secret) {
          await logWebhookEvent({
            stripe_event_id: null,
            event_type: null,
            signature_verified: false,
            status_code: 500,
            error: "STRIPE_WEBHOOK_SECRET not configured",
            raw_summary: null,
          });
          return new Response("Webhook not configured", { status: 500 });
        }

        const verified = verifyStripeSignature(payload, sig, secret);

        let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } } = {};
        try {
          event = JSON.parse(payload);
        } catch {
          await logWebhookEvent({
            stripe_event_id: null,
            event_type: null,
            signature_verified: verified,
            status_code: 400,
            error: "Bad JSON payload",
            raw_summary: null,
          });
          return new Response("Bad payload", { status: 400 });
        }

        const eventId = event.id ?? null;
        const eventType = event.type ?? null;
        const session = (event.data?.object ?? {}) as {
          id?: string;
          payment_intent?: string;
          amount_total?: number;
          currency?: string;
          metadata?: { report_id?: string; payment_id?: string };
        };
        const summary: Record<string, unknown> = {
          session_id: session.id ?? null,
          amount_total: session.amount_total ?? null,
          currency: session.currency ?? null,
          report_id: session.metadata?.report_id ?? null,
          payment_id: session.metadata?.payment_id ?? null,
        };

        if (!verified) {
          await logWebhookEvent({
            stripe_event_id: eventId,
            event_type: eventType,
            signature_verified: false,
            status_code: 401,
            error: "Invalid signature",
            raw_summary: summary,
          });
          return new Response("Invalid signature", { status: 401 });
        }

        if (eventType !== "checkout.session.completed") {
          await logWebhookEvent({
            stripe_event_id: eventId,
            event_type: eventType,
            signature_verified: true,
            status_code: 200,
            error: null,
            raw_summary: summary,
          });
          return new Response("ignored", { status: 200 });
        }

        const reportId = session.metadata?.report_id;
        const paymentId = session.metadata?.payment_id;
        if (!reportId || !paymentId) {
          await logWebhookEvent({
            stripe_event_id: eventId,
            event_type: eventType,
            signature_verified: true,
            status_code: 400,
            error: "Missing report_id/payment_id metadata",
            raw_summary: summary,
          });
          return new Response("Missing metadata", { status: 400 });
        }

        await supabaseAdmin
          .from("payments")
          .update({
            status: "completed",
            stripe_payment_intent_id: session.payment_intent ?? null,
          })
          .eq("id", paymentId);

        let generationError: string | null = null;
        try {
          await generateReportContent(reportId);
        } catch (err) {
          generationError = (err as Error).message;
          console.error("[stripe-webhook] generation failed:", generationError);
        }

        await logWebhookEvent({
          stripe_event_id: eventId,
          event_type: eventType,
          signature_verified: true,
          status_code: 200,
          error: generationError,
          raw_summary: summary,
        });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
