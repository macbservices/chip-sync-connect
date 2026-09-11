import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { approveRecharge } from "./payment-gateways.ts";

// NOTE: implemented against Mercado Pago's public /v1/payments PIX API
// contract but never exercised against a real (sandbox or production)
// account from this environment. Test with real credentials before relying
// on it for real charges.

type ServiceClient = ReturnType<typeof createClient>;
type Creds = Record<string, string>;
type Caller = { id: string; email?: string };

export async function createChargeMercadoPago(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  amountCents: number
) {
  const accessToken = credentials.access_token;
  if (!accessToken) return { error: "Mercado Pago não configurado" };

  const resp = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      // Required by Mercado Pago to make POST /v1/payments safely retryable.
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: amountCents / 100,
      description: "Recarga MAC-CHIP",
      payment_method_id: "pix",
      payer: { email: user.email || `${user.id}@mac-chip.local` },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Mercado Pago create payment error:", resp.status, errText);
    return { error: "Falha ao criar cobrança no Mercado Pago" };
  }

  const payment = await resp.json();
  const txData = payment.point_of_interaction?.transaction_data;

  const { data: recharge, error: rechargeError } = await serviceClient
    .from("recharge_requests")
    .insert({
      user_id: user.id,
      amount_cents: amountCents,
      status: "pending",
      external_reference: String(payment.id),
      admin_notes: `Mercado Pago payment_id: ${payment.id}`,
    })
    .select("id")
    .single();

  if (rechargeError) {
    console.error("Failed to persist recharge for MP payment:", rechargeError);
    return { error: "Falha ao registrar recarga" };
  }

  return {
    recharge_id: recharge.id,
    payment_id: payment.id,
    pix_copy_paste: txData?.qr_code,
    qr_code_image: txData?.qr_code_base64,
    expires_at: payment.date_of_expiration,
  };
}

export async function checkPaymentMercadoPago(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  rechargeId: string
) {
  const accessToken = credentials.access_token;
  if (!accessToken) return { error: "Mercado Pago não configurado" };

  const { data: recharge } = await serviceClient
    .from("recharge_requests")
    .select("id, user_id, status, external_reference")
    .eq("id", rechargeId)
    .maybeSingle();

  if (!recharge || recharge.user_id !== user.id) return { error: "Not found" };
  if (!recharge.external_reference) return { status: recharge.status };

  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${recharge.external_reference}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return { status: recharge.status, paid: false };

  const payment = await resp.json();

  if (payment.status === "approved" && recharge.status === "pending") {
    const result = await approveRecharge(
      serviceClient,
      rechargeId,
      `Mercado Pago confirmado. payment_id: ${recharge.external_reference}`
    );
    if (!result.ok) return { error: result.error };
    return { status: "approved", paid: true };
  }

  return { status: recharge.status, mp_status: payment.status, paid: false };
}
