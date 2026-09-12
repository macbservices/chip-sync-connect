import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getActiveGateway } from "../_shared/payment-gateways.ts";
import { createChargeMercadoPago, checkPaymentMercadoPago } from "../_shared/gateway-mercadopago.ts";
import { createChargeAsaas, checkPaymentAsaas } from "../_shared/gateway-asaas.ts";
import { createChargePixManual, checkPaymentPixManual } from "../_shared/gateway-pix-manual.ts";
import { createChargeStripe, checkPaymentStripe } from "../_shared/gateway-stripe.ts";
import { createChargePagBank, checkPaymentPagBank } from "../_shared/gateway-pagbank.ts";
import { createChargePicPay, checkPaymentPicPay } from "../_shared/gateway-picpay.ts";

// Unified payment router: looks up whichever gateway is marked active in
// payment_gateway_settings and dispatches to that provider's implementation.
// Same request/response contract as efi-pix (action: "create_charge" |
// "check_payment") so callers can point at this function instead without
// changing their code.
//
// NOT wired up to the live checkout yet: src/pages/Recharge.tsx still uses
// its own static-PIX-key + AI-verified-proof flow, and efi-pix is kept
// exactly as-is for backward compatibility. This function is the opt-in
// entry point for whenever the team decides to switch the live flow over —
// switching it before Efí (or another gateway) has real, tested credentials
// configured would break recharges, so that decision was deliberately left
// out of this change.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const activeGateway = await getActiveGateway(serviceClient);
    if (!activeGateway) {
      return json({ error: "Nenhum gateway de pagamento ativo" }, 500);
    }

    const body = await req.json();

    // Efí already has a fully working, independently tested implementation —
    // reuse it as-is via an internal call instead of duplicating its mTLS/
    // certificate handling here.
    if (activeGateway.gateway === "efi") {
      const resp = await fetch(`${supabaseUrl}/functions/v1/efi-pix`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await resp.text();
      return new Response(text, { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, amount_cents, recharge_id } = body;

    if (action === "create_charge") {
      if (!amount_cents || amount_cents < 500) {
        return json({ error: "Valor mínimo R$ 5,00" }, 400);
      }

      switch (activeGateway.gateway) {
        case "mercadopago":
          return json(await createChargeMercadoPago(serviceClient, activeGateway.credentials, user, amount_cents));
        case "asaas":
          return json(await createChargeAsaas(serviceClient, activeGateway.credentials, user, amount_cents));
        case "pix_manual":
          return json(await createChargePixManual(serviceClient, activeGateway.credentials, user, amount_cents));
        case "stripe":
          return json(await createChargeStripe(serviceClient, activeGateway.credentials, user, amount_cents));
        case "pagbank":
          return json(await createChargePagBank(serviceClient, activeGateway.credentials, user, amount_cents));
        case "picpay":
          return json(await createChargePicPay(serviceClient, activeGateway.credentials, user, amount_cents));
        default:
          return json({ error: `Gateway "${activeGateway.label}" ainda não implementado` }, 501);
      }
    }

    if (action === "check_payment") {
      if (!recharge_id) {
        return json({ error: "recharge_id required" }, 400);
      }

      switch (activeGateway.gateway) {
        case "mercadopago":
          return json(await checkPaymentMercadoPago(serviceClient, activeGateway.credentials, user, recharge_id));
        case "asaas":
          return json(await checkPaymentAsaas(serviceClient, activeGateway.credentials, user, recharge_id));
        case "pix_manual":
          return json(await checkPaymentPixManual(serviceClient, user, recharge_id));
        case "stripe":
          return json(await checkPaymentStripe(serviceClient, activeGateway.credentials, user, recharge_id));
        case "pagbank":
          return json(await checkPaymentPagBank(serviceClient, activeGateway.credentials, user, recharge_id));
        case "picpay":
          return json(await checkPaymentPicPay(serviceClient, activeGateway.credentials, user, recharge_id));
        default:
          return json({ error: `Gateway "${activeGateway.label}" ainda não implementado` }, 501);
      }
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("process-payment error:", err);
    return json({ error: "Erro interno ao processar pagamento. Tente novamente." }, 500);
  }
});
