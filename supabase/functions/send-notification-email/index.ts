import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    if (!ADMIN_EMAIL) {
      throw new Error("ADMIN_EMAIL is not configured");
    }

    const { type, data } = await req.json();

    let subject = "";
    let html = "";
    let to = ADMIN_EMAIL;

    switch (type) {
      case "new_ticket": {
        subject = `🎫 Novo ticket de suporte: ${data.subject}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Novo Ticket de Suporte</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Assunto:</strong> ${data.subject}</p>
              <p><strong>Mensagem:</strong></p>
              <p style="white-space: pre-wrap;">${data.message}</p>
              ${data.screenshot_url ? `<p><strong>Screenshot:</strong> <a href="${data.screenshot_url}">Ver anexo</a></p>` : ""}
            </div>
            <p style="color: #666;">Acesse o painel admin para responder.</p>
          </div>
        `;
        break;
      }

      case "chip_exhausted": {
        subject = `⚠️ Chip esgotado: ${data.phone_number}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e63946;">Chip Esgotado</h2>
            <div style="background: #fff3f3; padding: 20px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Chip:</strong> ${data.phone_number}</p>
              <p><strong>Serviço:</strong> ${data.service_type}</p>
              <p>O chip atingiu o limite de ativações e precisa ser substituído.</p>
            </div>
          </div>
        `;
        // Send to collaborator email if provided, otherwise admin
        to = data.collaborator_email || ADMIN_EMAIL;
        break;
      }

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MAC Chip <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", resData);
      throw new Error(`Resend error: ${JSON.stringify(resData)}`);
    }

    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
