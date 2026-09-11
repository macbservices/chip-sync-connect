import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  approveRecharge,
  findRechargeByExternalReference,
  getGatewayRow,
  hmacSha256Hex,
} from "../_shared/payment-gateways.ts";

// Webhook receiver for provider payment confirmations. No Supabase JWT is
// ever sent by these providers (config.toml sets verify_jwt = false for this
// function), so authenticity is checked per-provider instead:
//   - Mercado Pago: HMAC-SHA256 signature in the `x-signature` header,
//     verified against the gateway's configured webhook_secret.
//   - Asaas: shared token in the `asaas-access-token` header, compared to
//     the gateway's configured webhook_token.
//
// Configure each provider's webhook URL as:
//   https://<project>.functions.supabase.co/payment-webhook?gateway=mercadopago
//   https://<project>.functions.supabase.co/payment-webhook?gateway=asaas
//
// NOTE: written against each provider's publicly documented webhook contract
// but never exercised against a real notification from either provider.
// Verify against their sandbox before relying on it in production.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-signature, x-request-id, asaas-access-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function verifyMercadoPagoSignature(req: Request, secret: string, dataId: string): Promise<boolean> {
  const signatureHeader = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");
  if (!signatureHeader || !requestId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return expected === v1;
}

async function handleMercadoPago(req: Request, serviceClient: ReturnType<typeof createClient>) {
  const gatewayRow = await getGatewayRow(serviceClient, "mercadopago");
  if (!gatewayRow) return json({ error: "Gateway not configured" }, 404);

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const dataId = body?.data?.id ? String(body.data.id) : url.searchParams.get("data.id") || "";
  if (!dataId) return json({ received: true });

  const webhookSecret = gatewayRow.credentials.webhook_secret;
  if (webhookSecret) {
    const valid = await verifyMercadoPagoSignature(req, webhookSecret, dataId);
    if (!valid) {
      console.error("Mercado Pago webhook: invalid signature");
      return json({ error: "Invalid signature" }, 401);
    }
  } else {
    console.warn("Mercado Pago webhook_secret not configured — accepting notification without signature check");
  }

  const accessToken = gatewayRow.credentials.access_token;
  if (!accessToken) return json({ error: "Gateway not configured" }, 500);

  // Never trust the webhook body's own status — re-fetch from Mercado Pago.
  const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!paymentResp.ok) return json({ received: true });

  const payment = await paymentResp.json();
  if (payment.status !== "approved") return json({ received: true });

  const recharge = await findRechargeByExternalReference(serviceClient, dataId);
  if (!recharge) return json({ received: true });

  const result = await approveRecharge(serviceClient, recharge.id, `Mercado Pago confirmado via webhook. payment_id: ${dataId}`);
  return json({ received: true, approved: result.ok });
}

async function handleAsaas(req: Request, serviceClient: ReturnType<typeof createClient>) {
  const gatewayRow = await getGatewayRow(serviceClient, "asaas");
  if (!gatewayRow) return json({ error: "Gateway not configured" }, 404);

  const webhookToken = gatewayRow.credentials.webhook_token;
  if (webhookToken) {
    const provided = req.headers.get("asaas-access-token");
    if (provided !== webhookToken) {
      console.error("Asaas webhook: invalid token");
      return json({ error: "Invalid token" }, 401);
    }
  } else {
    console.warn("Asaas webhook_token not configured — accepting notification without token check");
  }

  const body = await req.json().catch(() => ({}));
  const event = body?.event as string | undefined;
  const paymentId = body?.payment?.id ? String(body.payment.id) : "";
  if (!paymentId) return json({ received: true });

  const confirmedEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
  if (!event || !confirmedEvents.includes(event)) return json({ received: true });

  const recharge = await findRechargeByExternalReference(serviceClient, paymentId);
  if (!recharge) return json({ received: true });

  const result = await approveRecharge(serviceClient, recharge.id, `Asaas confirmado via webhook. payment_id: ${paymentId}`);
  return json({ received: true, approved: result.ok });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const gateway = url.searchParams.get("gateway");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    if (gateway === "mercadopago") return await handleMercadoPago(req, serviceClient);
    if (gateway === "asaas") return await handleAsaas(req, serviceClient);

    return json({ error: "Unknown or missing ?gateway= parameter" }, 400);
  } catch (err) {
    console.error("payment-webhook error:", err);
    // Respond 200 so the provider doesn't hammer retries on our own bug;
    // the error is still logged above for investigation.
    return json({ received: true });
  }
});
