import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller
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

    const { recharge_id } = await req.json();
    if (!recharge_id) {
      return new Response(JSON.stringify({ error: "recharge_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get the recharge request
    const { data: recharge, error: rechError } = await adminClient
      .from("recharge_requests")
      .select("*")
      .eq("id", recharge_id)
      .single();

    if (rechError || !recharge) {
      return new Response(JSON.stringify({ error: "Recharge not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must be the owner
    if (recharge.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not your recharge" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must be pending
    if (recharge.status !== "pending") {
      return new Response(JSON.stringify({ error: "Recharge already processed", status: recharge.status }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must have proof
    if (!recharge.pix_proof_url) {
      return new Response(JSON.stringify({ error: "No proof uploaded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for duplicate proof: if any OTHER recharge with same proof was already approved
    const { data: duplicates } = await adminClient
      .from("recharge_requests")
      .select("id")
      .eq("pix_proof_url", recharge.pix_proof_url)
      .eq("status", "approved")
      .neq("id", recharge_id);

    if (duplicates && duplicates.length > 0) {
      // Mark as rejected
      await adminClient
        .from("recharge_requests")
        .update({ status: "rejected", admin_notes: "Comprovante já utilizado em outra recarga.", updated_at: new Date().toISOString() })
        .eq("id", recharge_id);

      return new Response(JSON.stringify({ error: "Este comprovante já foi utilizado em outra recarga.", approved: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get signed URL for the proof image
    const { data: signedData } = await adminClient.storage
      .from("pix-proofs")
      .createSignedUrl(recharge.pix_proof_url, 300);

    if (!signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Could not access proof file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the image and convert to base64
    const imageResponse = await fetch(signedData.signedUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const expectedAmountBRL = (recharge.amount_cents / 100).toFixed(2);

    // Call AI to analyze the receipt
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um verificador de comprovantes PIX. Analise a imagem do comprovante e extraia o valor da transação.
Responda APENAS usando a função fornecida. Seja preciso com o valor encontrado.
Se não for um comprovante PIX válido ou não conseguir identificar o valor, retorne is_valid como false.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise este comprovante PIX. O valor esperado é R$ ${expectedAmountBRL}. Verifique se:
1. É um comprovante PIX válido
2. O valor do comprovante corresponde ao valor esperado (R$ ${expectedAmountBRL})
Extraia o valor encontrado no comprovante.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${contentType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "verify_pix_receipt",
              description: "Report PIX receipt verification results",
              parameters: {
                type: "object",
                properties: {
                  is_valid: {
                    type: "boolean",
                    description: "Whether this is a valid PIX receipt",
                  },
                  amount_found: {
                    type: "number",
                    description: "The monetary amount found on the receipt in BRL (e.g. 50.00)",
                  },
                  amount_matches: {
                    type: "boolean",
                    description: "Whether the amount found matches the expected amount",
                  },
                  reason: {
                    type: "string",
                    description: "Brief explanation of the verification result",
                  },
                },
                required: ["is_valid", "amount_found", "amount_matches", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "verify_pix_receipt" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Serviço de verificação indisponível." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Erro na verificação automática" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI could not analyze the receipt", approved: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    const { is_valid, amount_matches, reason, amount_found } = result;

    if (is_valid && amount_matches) {
      // Auto-approve: use the same approve_recharge function
      const { error: approveError } = await adminClient.rpc("approve_recharge", {
        _recharge_id: recharge_id,
      });

      // The RPC checks for admin role, so we need to do it manually
      // Actually, the RPC uses auth.uid() which won't work with service role
      // Let's do it manually instead
      // Manual approval with service role since RPC uses auth.uid()
      // Get current balance first
      const { data: profile } = await adminClient
        .from("profiles")
        .select("balance_cents")
        .eq("user_id", recharge.user_id)
        .single();

      if (profile) {
        await adminClient
          .from("recharge_requests")
          .update({ status: "approved", admin_notes: `Auto-aprovado por IA: ${reason}`, updated_at: new Date().toISOString() })
          .eq("id", recharge_id);

        await adminClient
          .from("profiles")
          .update({
            balance_cents: profile.balance_cents + recharge.amount_cents,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", recharge.user_id);
      }

      return new Response(
        JSON.stringify({
          approved: true,
          reason,
          amount_found,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Not approved - update with AI notes
    await adminClient
      .from("recharge_requests")
      .update({
        admin_notes: `IA: ${reason} (valor encontrado: R$ ${amount_found?.toFixed(2) || "?"})`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recharge_id);

    return new Response(
      JSON.stringify({
        approved: false,
        reason,
        amount_found,
        is_valid,
        amount_matches,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("verify-pix error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
