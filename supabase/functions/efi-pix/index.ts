import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EFI_BASE_URL = "https://pix.api.efipay.com.br";

// Parse PEM to extract cert and key
function parsePem(pem: string): { cert: string; key: string } {
  const certMatch = pem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g
  );
  const keyMatch = pem.match(
    /-----BEGIN (RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (RSA |EC )?PRIVATE KEY-----/
  );

  if (!certMatch || !keyMatch) {
    throw new Error("Invalid PEM: could not extract certificate and/or private key");
  }

  return {
    cert: certMatch.join("\n"),
    key: keyMatch[0],
  };
}

// Get OAuth2 token from Efí using mTLS
async function getEfiToken(
  clientId: string,
  clientSecret: string,
  cert: string,
  key: string
): Promise<string> {
  const httpClient = Deno.createHttpClient({
    certChain: cert,
    privateKey: key,
  });

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${EFI_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
    client: httpClient,
  } as any);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Efí OAuth error:", response.status, errorText);
    throw new Error(`Efí OAuth failed: ${response.status}`);
  }

  const data = await response.json();
  httpClient.close();
  return data.access_token;
}

// Create immediate PIX charge
async function createPixCharge(
  token: string,
  cert: string,
  key: string,
  amountBRL: string,
  description: string
): Promise<any> {
  const httpClient = Deno.createHttpClient({
    certChain: cert,
    privateKey: key,
  });

  const response = await fetch(`${EFI_BASE_URL}/v2/cob`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      calendario: { expiracao: 3600 },
      valor: { original: amountBRL },
      chave: Deno.env.get("EFI_PIX_KEY") || "",
      infoAdicionais: [
        { nome: "Plataforma", valor: "MAC-CHIP" },
      ],
    }),
    client: httpClient,
  } as any);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Efí create charge error:", response.status, errorText);
    httpClient.close();
    throw new Error(`Failed to create charge: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  httpClient.close();
  return data;
}

// Get QR Code for a charge location
async function getQrCode(
  token: string,
  cert: string,
  key: string,
  locId: number
): Promise<any> {
  const httpClient = Deno.createHttpClient({
    certChain: cert,
    privateKey: key,
  });

  const response = await fetch(`${EFI_BASE_URL}/v2/loc/${locId}/qrcode`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    client: httpClient,
  } as any);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Efí QR code error:", response.status, errorText);
    httpClient.close();
    throw new Error(`Failed to get QR code: ${response.status}`);
  }

  const data = await response.json();
  httpClient.close();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, amount_cents, recharge_id } = await req.json();

    const clientId = Deno.env.get("EFI_CLIENT_ID");
    const clientSecret = Deno.env.get("EFI_CLIENT_SECRET");
    const certificate = Deno.env.get("EFI_CERTIFICATE");

    if (!clientId || !clientSecret || !certificate) {
      return new Response(JSON.stringify({ error: "Efí not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cert, key } = parsePem(certificate);

    if (action === "create_charge") {
      if (!amount_cents || amount_cents < 500) {
        return new Response(JSON.stringify({ error: "Valor mínimo R$ 5,00" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountBRL = (amount_cents / 100).toFixed(2);

      // Get token
      const token = await getEfiToken(clientId, clientSecret, cert, key);

      // Create charge
      const charge = await createPixCharge(token, cert, key, amountBRL, "Recarga MAC-CHIP");

      // Get QR code
      let qrcode = null;
      if (charge.loc?.id) {
        qrcode = await getQrCode(token, cert, key, charge.loc.id);
      }

      // Create recharge request in DB
      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      const { data: recharge, error: rechargeError } = await serviceClient
        .from("recharge_requests")
        .insert({
          user_id: user.id,
          amount_cents,
          status: "pending",
          admin_notes: `txid: ${charge.txid}`,
        })
        .select("id")
        .single();

      if (rechargeError) throw rechargeError;

      return new Response(
        JSON.stringify({
          recharge_id: recharge.id,
          txid: charge.txid,
          pix_copy_paste: charge.pixCopiaECola,
          qr_code_image: qrcode?.imagemQrcode, // base64 image
          qr_code_link: qrcode?.qrcode,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check_payment") {
      if (!recharge_id) {
        return new Response(JSON.stringify({ error: "recharge_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      const { data: recharge } = await serviceClient
        .from("recharge_requests")
        .select("*")
        .eq("id", recharge_id)
        .single();

      if (!recharge || recharge.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract txid from admin_notes
      const txidMatch = recharge.admin_notes?.match(/txid: (.+)/);
      if (!txidMatch) {
        return new Response(JSON.stringify({ status: recharge.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const txid = txidMatch[1];
      const token = await getEfiToken(clientId, clientSecret, cert, key);

      // Check charge status at Efí
      const httpClient = Deno.createHttpClient({
        certChain: cert,
        privateKey: key,
      });

      const chargeResponse = await fetch(`${EFI_BASE_URL}/v2/cob/${txid}`, {
        headers: { Authorization: `Bearer ${token}` },
        client: httpClient,
      } as any);

      const chargeData = await chargeResponse.json();
      httpClient.close();

      if (chargeData.status === "CONCLUIDA" && recharge.status === "pending") {
        // Payment confirmed - approve recharge
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("balance_cents")
          .eq("user_id", recharge.user_id)
          .single();

        if (profile) {
          await serviceClient
            .from("recharge_requests")
            .update({
              status: "approved",
              admin_notes: `PIX confirmado via Efí. txid: ${txid}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", recharge_id);

          await serviceClient
            .from("profiles")
            .update({
              balance_cents: profile.balance_cents + recharge.amount_cents,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", recharge.user_id);
        }

        return new Response(
          JSON.stringify({ status: "approved", paid: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: recharge.status,
          efi_status: chargeData.status,
          paid: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("efi-pix error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
