import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { approveRecharge } from "./payment-gateways.ts";

// NOTE: implemented against Asaas's public /v3 PIX payment API contract but
// never exercised against a real (sandbox or production) account from this
// environment. Test with real credentials before relying on it for real
// charges. Asaas requires a `customer` object per payment; one is created
// (or reused, matched by externalReference = our user id) automatically.

type ServiceClient = ReturnType<typeof createClient>;
type Creds = Record<string, string>;
type Caller = { id: string; email?: string };

function baseUrl(credentials: Creds): string {
  return credentials.environment === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
}

async function getOrCreateCustomer(base: string, apiKey: string, user: Caller): Promise<string> {
  const searchResp = await fetch(`${base}/customers?externalReference=${encodeURIComponent(user.id)}`, {
    headers: { access_token: apiKey },
  });
  if (searchResp.ok) {
    const searchData = await searchResp.json();
    if (searchData.data?.length > 0) return searchData.data[0].id;
  }

  const createResp = await fetch(`${base}/customers`, {
    method: "POST",
    headers: { access_token: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: user.email?.split("@")[0] || "Cliente MAC-CHIP",
      email: user.email,
      externalReference: user.id,
    }),
  });
  if (!createResp.ok) {
    throw new Error(`Falha ao criar cliente no Asaas: ${await createResp.text()}`);
  }
  const created = await createResp.json();
  return created.id;
}

export async function createChargeAsaas(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  amountCents: number
) {
  const apiKey = credentials.api_key;
  if (!apiKey) return { error: "Asaas não configurado" };
  const base = baseUrl(credentials);

  try {
    const customerId = await getOrCreateCustomer(base, apiKey, user);

    const paymentResp = await fetch(`${base}/payments`, {
      method: "POST",
      headers: { access_token: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: amountCents / 100,
        dueDate: new Date().toISOString().slice(0, 10),
        description: "Recarga MAC-CHIP",
      }),
    });

    if (!paymentResp.ok) {
      console.error("Asaas create payment error:", paymentResp.status, await paymentResp.text());
      return { error: "Falha ao criar cobrança no Asaas" };
    }

    const payment = await paymentResp.json();

    const qrResp = await fetch(`${base}/payments/${payment.id}/pixQrCode`, {
      headers: { access_token: apiKey },
    });
    const qrData = qrResp.ok ? await qrResp.json() : null;

    const { data: recharge, error: rechargeError } = await serviceClient
      .from("recharge_requests")
      .insert({
        user_id: user.id,
        amount_cents: amountCents,
        status: "pending",
        external_reference: String(payment.id),
        admin_notes: `Asaas payment_id: ${payment.id}`,
      })
      .select("id")
      .single();

    if (rechargeError) {
      console.error("Failed to persist recharge for Asaas payment:", rechargeError);
      return { error: "Falha ao registrar recarga" };
    }

    return {
      recharge_id: recharge.id,
      payment_id: payment.id,
      pix_copy_paste: qrData?.payload,
      qr_code_image: qrData?.encodedImage,
      expires_at: qrData?.expirationDate,
    };
  } catch (err) {
    console.error("Asaas createCharge error:", err);
    return { error: "Falha ao criar cobrança no Asaas" };
  }
}

export async function checkPaymentAsaas(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  rechargeId: string
) {
  const apiKey = credentials.api_key;
  if (!apiKey) return { error: "Asaas não configurado" };
  const base = baseUrl(credentials);

  const { data: recharge } = await serviceClient
    .from("recharge_requests")
    .select("id, user_id, status, external_reference")
    .eq("id", rechargeId)
    .maybeSingle();

  if (!recharge || recharge.user_id !== user.id) return { error: "Not found" };
  if (!recharge.external_reference) return { status: recharge.status };

  const resp = await fetch(`${base}/payments/${recharge.external_reference}`, {
    headers: { access_token: apiKey },
  });
  if (!resp.ok) return { status: recharge.status, paid: false };

  const payment = await resp.json();
  const confirmed = payment.status === "RECEIVED" || payment.status === "CONFIRMED";

  if (confirmed && recharge.status === "pending") {
    const result = await approveRecharge(
      serviceClient,
      rechargeId,
      `Asaas confirmado. payment_id: ${recharge.external_reference}`
    );
    if (!result.ok) return { error: result.error };
    return { status: "approved", paid: true };
  }

  return { status: recharge.status, asaas_status: payment.status, paid: false };
}
