/**
 * Stripe integration helpers for NeuraMeter billing.
 *
 * Requires STRIPE_SECRET_KEY and STRIPE_PRICE_IDS env vars.
 * These are placeholder implementations — full Stripe integration
 * requires the stripe npm package and webhook configuration.
 */

export const PLAN_PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO ?? 'price_pro_placeholder',
  team: process.env.STRIPE_PRICE_TEAM ?? 'price_team_placeholder',
} as const;

export interface CreateCheckoutParams {
  orgId: string;
  plan: 'pro' | 'team';
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout session for plan upgrade.
 * Returns the checkout URL.
 */
export async function createCheckoutSession(params: CreateCheckoutParams): Promise<string | null> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return null;

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        mode: 'subscription',
        'line_items[0][price]': PLAN_PRICE_IDS[params.plan],
        'line_items[0][quantity]': '1',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        'metadata[org_id]': params.orgId,
      }),
    });

    const session = await response.json();
    return session.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Create a Stripe Customer Portal session for managing subscription.
 */
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<string | null> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return null;

  try {
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: stripeCustomerId,
        return_url: returnUrl,
      }),
    });

    const session = await response.json();
    return session.url ?? null;
  } catch {
    return null;
  }
}
