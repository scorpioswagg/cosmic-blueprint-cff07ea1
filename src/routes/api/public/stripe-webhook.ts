// Stripe webhook endpoint. Verifies the signature, marks the payment as paid,
// and triggers generation of the associated report.
//
// Configure in Stripe Dashboard → Webhooks with the event
//   - checkout.session.completed
// pointed at this route. STRIPE_WEBHOOK_SECRET is the signing secret.
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
  // Header format: t=timestamp,v1=signature[,v1=signature...]
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

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook not configured", { status: 500 });

        const payload = await request.text();
        const sig = request.headers.get("stripe-signature");
        if (!verifyStripeSignature(payload, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: { type: string; data: { object: Record<string, unknown> } };
        try {
          event = JSON.parse(payload);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        if (event.type !== "checkout.session.completed") {
          return new Response("ignored", { status: 200 });
        }

        const session = event.data.object as {
          id?: string;
          payment_intent?: string;
          metadata?: { report_id?: string; payment_id?: string };
        };
        const reportId = session.metadata?.report_id;
        const paymentId = session.metadata?.payment_id;
        if (!reportId || !paymentId) {
          return new Response("Missing metadata", { status: 400 });
        }

        // Mark payment paid
        await supabaseAdmin
          .from("payments")
          .update({
            status: "completed",
            stripe_payment_intent_id: session.payment_intent ?? null,
          })
          .eq("id", paymentId);

        // Generate the report
        try {
          await generateReportContent(reportId);
        } catch (err) {
          console.error("[stripe-webhook] generation failed:", (err as Error).message);
          // We still return 200 — Stripe should not retry; the report row is marked 'failed'.
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
