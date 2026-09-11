import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type GatewayRow = {
  gateway: string;
  label: string;
  is_active: boolean;
  credentials: Record<string, string>;
};

type ServiceClient = ReturnType<typeof createClient>;

export async function getGatewayRow(serviceClient: ServiceClient, gateway: string): Promise<GatewayRow | null> {
  const { data } = await serviceClient
    .from("payment_gateway_settings")
    .select("gateway, label, is_active, credentials")
    .eq("gateway", gateway)
    .maybeSingle();
  return (data as GatewayRow) || null;
}

export async function getActiveGateway(serviceClient: ServiceClient): Promise<GatewayRow | null> {
  const { data } = await serviceClient
    .from("payment_gateway_settings")
    .select("gateway, label, is_active, credentials")
    .eq("is_active", true)
    .maybeSingle();
  return (data as GatewayRow) || null;
}

/**
 * Approve a pending recharge and credit the user's balance. Idempotent: a
 * recharge that isn't "pending" anymore (already approved/rejected) is left
 * untouched, since payment providers commonly retry webhook delivery.
 */
export async function approveRecharge(
  serviceClient: ServiceClient,
  rechargeId: string,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: recharge } = await serviceClient
    .from("recharge_requests")
    .select("id, user_id, amount_cents, status")
    .eq("id", rechargeId)
    .maybeSingle();

  if (!recharge) return { ok: false, error: "Recharge not found" };
  if (recharge.status !== "pending") return { ok: true };

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("balance_cents")
    .eq("user_id", recharge.user_id)
    .maybeSingle();

  if (!profile) return { ok: false, error: "Profile not found" };

  await serviceClient
    .from("recharge_requests")
    .update({ status: "approved", admin_notes: note, updated_at: new Date().toISOString() })
    .eq("id", rechargeId);

  await serviceClient
    .from("profiles")
    .update({ balance_cents: profile.balance_cents + recharge.amount_cents, updated_at: new Date().toISOString() })
    .eq("user_id", recharge.user_id);

  return { ok: true };
}

export async function findRechargeByExternalReference(
  serviceClient: ServiceClient,
  externalReference: string
): Promise<{ id: string; status: string } | null> {
  const { data } = await serviceClient
    .from("recharge_requests")
    .select("id, status")
    .eq("external_reference", externalReference)
    .maybeSingle();
  return data || null;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bufferToHex(signature);
}
