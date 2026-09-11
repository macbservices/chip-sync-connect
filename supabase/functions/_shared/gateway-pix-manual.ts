import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Static PIX key + manual/AI-verified proof, same idea as the flow already
// built directly into src/pages/Recharge.tsx. No external API call: the
// customer pays into the configured key and uploads a proof, which an admin
// (or the existing verify-pix AI check) approves.

type ServiceClient = ReturnType<typeof createClient>;
type Creds = Record<string, string>;
type Caller = { id: string };

export async function createChargePixManual(
  serviceClient: ServiceClient,
  credentials: Creds,
  user: Caller,
  amountCents: number
) {
  const pixKey = credentials.pix_key;
  if (!pixKey) return { error: "Chave PIX manual não configurada" };

  const { data: recharge, error: rechargeError } = await serviceClient
    .from("recharge_requests")
    .insert({ user_id: user.id, amount_cents: amountCents, status: "pending" })
    .select("id")
    .single();

  if (rechargeError) {
    console.error("Failed to create manual PIX recharge:", rechargeError);
    return { error: "Falha ao registrar recarga" };
  }

  return {
    recharge_id: recharge.id,
    manual: true,
    pix_key: pixKey,
    pix_key_type: credentials.pix_key_type || null,
    holder_name: credentials.holder_name || null,
    holder_city: credentials.holder_city || null,
  };
}

export async function checkPaymentPixManual(serviceClient: ServiceClient, user: Caller, rechargeId: string) {
  const { data: recharge } = await serviceClient
    .from("recharge_requests")
    .select("id, user_id, status")
    .eq("id", rechargeId)
    .maybeSingle();

  if (!recharge || recharge.user_id !== user.id) return { error: "Not found" };

  return { status: recharge.status, paid: recharge.status === "approved" };
}
