import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { approveRecharge, hmacSha256Hex } from "./payment-gateways.ts";

// NOTE: implemented against Stripe's public PaymentIntents + PIX payment
// method docs but never exercised against a real (test or live) Stripe
// account from this environment. Test with real credentials before relying
// on it for real charges.

type ServiceClient = ReturnType<typeof createClient>;
type Creds = Record<string, string>;
type Caller = { id: string; email?: string };

// Stripe's REST API takes classic form-encoded bodies, not JSON.
function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export async function createChargeStripe(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  amountCents: number
) {
  const secretKey = credentials.secret_key;
  if (!secretKey) return { error: "Stripe não configurado" };

  const resp = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode({
      amount: String(amountCents),
      currency: "brl",
      "payment_method_types[]": "pix",
      "payment_method_data[type]": "pix",
      confirm: "true",
      description: "Recarga MAC-CHIP",
      "metadata[user_id]": user.id,
    }),
  });

  if (!resp.ok) {
    console.error("Stripe create payment_intent error:", resp.status, await resp.text());
    return { error: "Falha ao criar cobrança na Stripe" };
  }

  const intent = await resp.json();
  const qr = intent.next_action?.pix_display_qr_code;

  const { data: recharge, error: rechargeError } = await serviceClient
    .from("recharge_requests")
    .insert({
      user_id: user.id,
      amount_cents: amountCents,
      status: "pending",
      external_reference: intent.id,
      admin_notes: `Stripe payment_intent: ${intent.id}`,
    })
    .select("id")
    .single();

  if (rechargeError) {
    console.error("Failed to persist recharge for Stripe payment_intent:", rechargeError);
    return { error: "Falha ao registrar recarga" };
  }

  return {
    recharge_id: recharge.id,
    payment_id: intent.id,
    pix_copy_paste: qr?.data,
    qr_code_image: qr?.image_url_png,
    expires_at: qr?.expires_at ? new Date(qr.expires_at * 1000).toISOString() : undefined,
  };
}

export async function checkPaymentStripe(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  rechargeId: string
) {
  const secretKey = credentials.secret_key;
  if (!secretKey) return { error: "Stripe não configurado" };

  const { data: recharge } = await serviceClient
    .from("recharge_requests")
    .select("id, user_id, status, external_reference")
    .eq("id", rechargeId)
    .maybeSingle();

  if (!recharge || recharge.user_id !== user.id) return { error: "Not found" };
  if (!recharge.external_reference) return { status: recharge.status };

  const resp = await fetch(`https://api.stripe.com/v1/payment_intents/${recharge.external_reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!resp.ok) return { status: recharge.status, paid: false };

  const intent = await resp.json();

  if (intent.status === "succeeded" && recharge.status === "pending") {
    const result = await approveRecharge(
      serviceClient,
      rechargeId,
      `Stripe confirmado. payment_intent: ${recharge.external_reference}`
    );
    if (!result.ok) return { error: result.error };
    return { status: "approved", paid: true };
  }

  return { status: recharge.status, stripe_status: intent.status, paid: false };
}

export type StripeEvent = {
  type: string;
  data?: { object?: { id?: string; status?: string } };
};

/**
 * Verifies Stripe's `Stripe-Signature` header against the raw (unparsed)
 * request body. Must be called with the exact bytes Stripe sent — parsing
 * to JSON and re-serializing before this check would invalidate it.
 */
export async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string,
  secret: string
): Promise<{ valid: boolean; event?: StripeEvent }> {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return { valid: false };

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  if (expected !== v1) return { valid: false };

  try {
    return { valid: true, event: JSON.parse(rawBody) };
  } catch {
    return { valid: false };
  }
}
