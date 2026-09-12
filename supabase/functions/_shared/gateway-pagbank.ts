import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { approveRecharge } from "./payment-gateways.ts";

// NOTE: implemented against PagBank's public v4 "Orders" PIX QR code API but
// never exercised against a real (sandbox or production) account from this
// environment — field names in particular should be double-checked against
// PagBank's current docs before relying on this. PagBank's webhook payload
// has no broadly-documented signature scheme to verify here, so instead of
// trusting it, the order is always re-fetched from PagBank's own API before
// crediting anything (see fetchPagBankOrderPaid, used by payment-webhook).

type ServiceClient = ReturnType<typeof createClient>;
type Creds = Record<string, string>;
type Caller = { id: string; email?: string };

type PagBankOrder = {
  id: string;
  qr_codes?: { text?: string; expiration_date?: string; links?: { media: string; href: string }[] }[];
  charges?: { status: string }[];
};

function baseUrl(credentials: Creds): string {
  return credentials.environment === "sandbox"
    ? "https://sandbox.api.pagseguro.com"
    : "https://api.pagseguro.com";
}

export async function createChargePagBank(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  amountCents: number
) {
  const token = credentials.token;
  if (!token) return { error: "PagBank não configurado" };
  const base = baseUrl(credentials);

  const resp = await fetch(`${base}/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: { name: user.email?.split("@")[0] || "Cliente MAC-CHIP", email: user.email },
      items: [{ name: "Recarga MAC-CHIP", quantity: 1, unit_amount: amountCents }],
      qr_codes: [{ amount: { value: amountCents } }],
    }),
  });

  if (!resp.ok) {
    console.error("PagBank create order error:", resp.status, await resp.text());
    return { error: "Falha ao criar cobrança no PagBank" };
  }

  const order = (await resp.json()) as PagBankOrder;
  const qr = order.qr_codes?.[0];
  const pngLink = (qr?.links || []).find((l) => l.media === "image/png");

  const { data: recharge, error: rechargeError } = await serviceClient
    .from("recharge_requests")
    .insert({
      user_id: user.id,
      amount_cents: amountCents,
      status: "pending",
      external_reference: order.id,
      admin_notes: `PagBank order_id: ${order.id}`,
    })
    .select("id")
    .single();

  if (rechargeError) {
    console.error("Failed to persist recharge for PagBank order:", rechargeError);
    return { error: "Falha ao registrar recarga" };
  }

  return {
    recharge_id: recharge.id,
    payment_id: order.id,
    pix_copy_paste: qr?.text,
    qr_code_image: pngLink?.href,
    expires_at: qr?.expiration_date,
  };
}

async function fetchOrder(credentials: Creds, orderId: string): Promise<PagBankOrder | null> {
  const token = credentials.token;
  if (!token) return null;
  const resp = await fetch(`${baseUrl(credentials)}/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  return (await resp.json()) as PagBankOrder;
}

function orderIsPaid(order: PagBankOrder | null): boolean {
  return (order?.charges || []).some((c) => c.status === "PAID");
}

export async function checkPaymentPagBank(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  rechargeId: string
) {
  if (!credentials.token) return { error: "PagBank não configurado" };

  const { data: recharge } = await serviceClient
    .from("recharge_requests")
    .select("id, user_id, status, external_reference")
    .eq("id", rechargeId)
    .maybeSingle();

  if (!recharge || recharge.user_id !== user.id) return { error: "Not found" };
  if (!recharge.external_reference) return { status: recharge.status };

  const order = await fetchOrder(credentials, recharge.external_reference);
  if (!order) return { status: recharge.status, paid: false };

  if (orderIsPaid(order) && recharge.status === "pending") {
    const result = await approveRecharge(
      serviceClient,
      rechargeId,
      `PagBank confirmado. order_id: ${recharge.external_reference}`
    );
    if (!result.ok) return { error: result.error };
    return { status: "approved", paid: true };
  }

  return { status: recharge.status, paid: false };
}

/** Used by payment-webhook to re-verify a notification against PagBank's own API. */
export async function fetchPagBankOrderPaid(credentials: Creds, orderId: string): Promise<boolean> {
  const order = await fetchOrder(credentials, orderId);
  return order ? orderIsPaid(order) : false;
}
