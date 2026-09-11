import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Escape user-controlled values before interpolating them into HTML email bodies.
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

    // Require a caller identity: either a logged-in user (the normal client
    // flow, e.g. Support.tsx submitting a ticket) or the project's own
    // service role key (used by trusted server-side/database triggers).
    // This function used to accept unauthenticated requests, letting anyone
    // who found the URL send arbitrary emails "from" this app.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice(7);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
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
    }

    const { type, data } = await req.json();

    let subject = "";
    let html = "";
    let to = ADMIN_EMAIL;

    switch (type) {
      case "new_ticket": {
        const safeSubject = escapeHtml(data?.subject).slice(0, 500);
        const safeMessage = escapeHtml(data?.message).slice(0, 5000);
        subject = `🎫 Novo ticket de suporte: ${safeSubject}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Novo Ticket de Suporte</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Assunto:</strong> ${safeSubject}</p>
              <p><strong>Mensagem:</strong></p>
              <p style="white-space: pre-wrap;">${safeMessage}</p>
            </div>
            <p style="color: #666;">Acesse o painel admin para responder.</p>
          </div>
        `;
        break;
      }

      case "chip_exhausted": {
        // Only a trusted server-side caller (service role) may trigger this
        // type, since it lets the caller choose the recipient address.
        if (!isServiceRole) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const safePhone = escapeHtml(data?.phone_number).slice(0, 30);
        const safeServiceType = escapeHtml(data?.service_type).slice(0, 50);
        subject = `⚠️ Chip esgotado: ${safePhone}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e63946;">Chip Esgotado</h2>
            <div style="background: #fff3f3; padding: 20px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Chip:</strong> ${safePhone}</p>
              <p><strong>Serviço:</strong> ${safeServiceType}</p>
              <p>O chip atingiu o limite de ativações e precisa ser substituído.</p>
            </div>
          </div>
        `;
        // Send to collaborator email if provided and well-formed, otherwise admin
        const collaboratorEmail = typeof data?.collaborator_email === "string"
          ? data.collaborator_email.trim()
          : "";
        to = collaboratorEmail && EMAIL_RE.test(collaboratorEmail) ? collaboratorEmail : ADMIN_EMAIL;
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
