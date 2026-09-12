import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { approveRecharge } from "./payment-gateways.ts";

// NOTE: implemented against PicPay Empresas' public checkout API but never
// exercised against a real account from this environment.
//
// IMPORTANT LIMITATION: PicPay's payment-creation endpoint requires a valid
// buyer CPF/CNPJ (`buyer.document`), which this app does not currently
// collect from customers. Until that's added, real calls to PicPay are
// expected to be rejected — this is scaffolding, not a working integration,
// despite following the documented request/response shape below.
//
// PicPay's callback carries no verifiable signature, so — like PagBank —
// the payment status is always re-fetched from PicPay's own API before
// crediting anything, never trusted from the callback body directly.

type ServiceClient = ReturnType<typeof createClient>;
type Creds = Record<string, string>;
type Caller = { id: string; email?: string };

const PICPAY_BASE = "https://appws.picpay.com/ecommerce/public";

export async function createChargePicPay(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  amountCents: number
) {
  const token = credentials.x_picpay_token;
  if (!token) return { error: "PicPay não configurado" };

  const { data: recharge, error: rechargeError } = await serviceClient
    .from("recharge_requests")
    .insert({ user_id: user.id, amount_cents: amountCents, status: "pending" })
    .select("id")
    .single();

  if (rechargeError) {
    console.error("Failed to create pending recharge for PicPay:", rechargeError);
    return { error: "Falha ao registrar recarga" };
  }

  const resp = await fetch(`${PICPAY_BASE}/payments`, {
    method: "POST",
    headers: { "x-picpay-token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      referenceId: recharge.id,
      callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?gateway=picpay`,
      value: amountCents / 100,
      buyer: {
        firstName: user.email?.split("@")[0] || "Cliente",
        lastName: "MAC-CHIP",
        email: user.email || `${user.id}@mac-chip.local`,
        // document (CPF/CNPJ) intentionally omitted — see file header note.
      },
    }),
  });

  if (!resp.ok) {
    console.error("PicPay create payment error:", resp.status, await resp.text());
    await serviceClient
      .from("recharge_requests")
      .update({ status: "rejected", admin_notes: "Falha ao criar cobrança PicPay (ver logs da função)" })
      .eq("id", recharge.id);
    return { error: "Falha ao criar cobrança no PicPay" };
  }

  const payment = await resp.json();

  await serviceClient
    .from("recharge_requests")
    .update({ external_reference: recharge.id, admin_notes: `PicPay referenceId: ${recharge.id}` })
    .eq("id", recharge.id);

  return {
    recharge_id: recharge.id,
    payment_id: recharge.id,
    pix_copy_paste: payment.qrcode?.content,
    qr_code_image: payment.qrcode?.base64,
    payment_url: payment.paymentUrl,
    expires_at: payment.expiresAt,
  };
}

async function fetchStatus(credentials: Creds, referenceId: string): Promise<string | null> {
  const token = credentials.x_picpay_token;
  if (!token) return null;
  const resp = await fetch(`${PICPAY_BASE}/payments/${referenceId}/status`, {
    headers: { "x-picpay-token": token },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.status ?? null;
}

export async function checkPaymentPicPay(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  rechargeId: string
) {
  if (!credentials.x_picpay_token) return { error: "PicPay não configurado" };

  const { data: recharge } = await serviceClient
    .from("recharge_requests")
    .select("id, user_id, status")
    .eq("id", rechargeId)
    .maybeSingle();

  if (!recharge || recharge.user_id !== user.id) return { error: "Not found" };

  const status = await fetchStatus(credentials, rechargeId);

  if (status === "paid" && recharge.status === "pending") {
    const result = await approveRecharge(serviceClient, rechargeId, `PicPay confirmado. referenceId: ${rechargeId}`);
    if (!result.ok) return { error: result.error };
    return { status: "approved", paid: true };
  }

  return { status: recharge.status, picpay_status: status, paid: false };
}

/** Used by payment-webhook to re-verify a callback against PicPay's own API. */
export async function fetchPicPayStatusPaid(credentials: Creds, referenceId: string): Promise<boolean> {
  return (await fetchStatus(credentials, referenceId)) === "paid";
}
