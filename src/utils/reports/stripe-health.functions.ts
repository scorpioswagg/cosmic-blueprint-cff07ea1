// Admin-only health check for the Stripe webhook.
// Returns:
//   - whether STRIPE_WEBHOOK_SECRET is configured
//   - the public webhook URL to register in Stripe
//   - recent webhook attempts (verified / invalid / ignored) with the most
//     recent verified `checkout.session.completed` highlighted.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface WebhookEventRow {
  id: string;
  received_at: string;
  stripe_event_id: string | null;
  event_type: string | null;
  signature_verified: boolean;
  status_code: number;
  error: string | null;
  raw_summary: Record<string, unknown> | null;
}

export const getStripeWebhookStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roleRow } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return { ok: false as const, error: "Admin access required." };
    }

    const secretConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
    const stripeKeyConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

    let host = "";
    try {
      host = getRequestHost();
    } catch {
      // not in request context — leave blank
    }
    const webhookUrl = host
      ? `https://${host}/api/public/stripe-webhook`
      : "/api/public/stripe-webhook";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events, error } = await (supabaseAdmin as any)
      .from("stripe_webhook_events")
      .select(
        "id, received_at, stripe_event_id, event_type, signature_verified, status_code, error, raw_summary",
      )
      .order("received_at", { ascending: false })
      .limit(25);

    if (error) {
      return { ok: false as const, error: error.message };
    }

    const rows = (events ?? []) as WebhookEventRow[];

    const totals = {
      total: rows.length,
      verified: rows.filter((r) => r.signature_verified).length,
      invalid: rows.filter((r) => !r.signature_verified).length,
      checkoutCompleted: rows.filter(
        (r) => r.signature_verified && r.event_type === "checkout.session.completed",
      ).length,
    };

    const lastVerifiedCheckout =
      rows.find(
        (r) => r.signature_verified && r.event_type === "checkout.session.completed",
      ) ?? null;
    const lastInvalidSignature = rows.find((r) => !r.signature_verified) ?? null;

    return {
      ok: true as const,
      config: {
        signingSecretConfigured: secretConfigured,
        stripeSecretConfigured: stripeKeyConfigured,
        webhookUrl,
        expectedEvent: "checkout.session.completed",
      },
      totals,
      lastVerifiedCheckout,
      lastInvalidSignature,
      events: rows,
    };
  });
