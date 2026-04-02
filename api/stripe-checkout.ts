import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/stripe-checkout
 *
 * Creates a Stripe Checkout session for MCP Sentinel Pro.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY   — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_PRICE_ID     — Stripe Price ID for the Pro plan (price_...)
 *   NEXT_PUBLIC_URL     — Public URL of the site for redirect (e.g. https://mcp-sentinel.com)
 *
 * Body: { email?: string, quantity?: number }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "https://mcp-sentinel.com";

  if (!stripeKey || !priceId) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const body = req.body as { email?: string; quantity?: number } | null;
  const quantity = Math.max(1, Math.min(100, body?.quantity ?? 1));

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": String(quantity),
        mode: "subscription",
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/#pricing`,
        ...(body?.email ? { customer_email: body.email } : {}),
        "metadata[product]": "mcp-sentinel-pro",
      }),
    });

    if (!response.ok) {
      const err = (await response.json()) as { error?: { message?: string } };
      res.status(400).json({ error: err.error?.message ?? "Stripe error" });
      return;
    }

    const session = (await response.json()) as { url: string; id: string };
    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch {
    res.status(500).json({ error: "Failed to create checkout session" });
  }
}
