import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Validation helpers
function isValidString(val: unknown, maxLen: number): val is string {
  return typeof val === "string" && val.length > 0 && val.length <= maxLen;
}

function sanitizeString(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen).replace(/[^\w\s+\-().@]/g, "");
}

function isValidPhoneNumber(val: unknown): val is string {
  return typeof val === "string" && /^[\d+\-() ]{3,30}$/.test(val);
}

function isValidSignalStrength(val: unknown): boolean {
  // Accept both CSQ values (0-31, 99) and dBm values (-120 to 0)
  return val === undefined || val === null || (typeof val === "number" && val >= -120 && val <= 99);
}

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey.length > 128) {
      return new Response(JSON.stringify({ error: "API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate API key against locations
    const { data: location, error: locError } = await supabase
      .from("locations")
      .select("id, user_id, is_active")
      .eq("api_key", apiKey)
      .single();

    if (locError || !location || !location.is_active) {
      return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_seen
    await supabase
      .from("locations")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", location.id);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // GET /gsm-gateway/pending - return chips with active orders needing SMS read
    if (req.method === "GET" && path === "pending") {
      // Find modems belonging to this location
      const { data: locationModems } = await supabase
        .from("modems")
        .select("id, port_name")
        .eq("location_id", location.id);

      if (!locationModems || locationModems.length === 0) {
        return new Response(JSON.stringify({ pending: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const modemIds = locationModems.map((m) => m.id);

      // Find chips with active orders that have NO SMS yet after order creation
      const { data: chipsWithOrders } = await supabase
        .from("orders")
        .select("id, chip_id, created_at, chips!inner(id, phone_number, modem_id)")
        .in("status", ["active", "paid"])
        .not("chip_id", "is", null);

      const pending: Array<{ phone_number: string; port_name: string; order_created_at: string }> = [];

      for (const order of chipsWithOrders || []) {
        const chip = order.chips as unknown as { id: string; phone_number: string; modem_id: string };
        if (!chip) continue;

        // Only chips belonging to this location's modems
        const modem = locationModems.find((m) => m.id === chip.modem_id);
        if (!modem) continue;

        // Check if SMS already received for this order
        const { data: existingSms } = await supabase
          .from("sms_logs")
          .select("id")
          .eq("chip_id", chip.id)
          .eq("direction", "incoming")
          .gte("received_at", order.created_at)
          .limit(1);

        if (!existingSms || existingSms.length === 0) {
          pending.push({
            phone_number: chip.phone_number,
            port_name: modem.port_name,
            order_created_at: order.created_at,
          });
        }
      }

      return new Response(JSON.stringify({ pending }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /gsm-gateway/sms - receive SMS from Python client
    if (req.method === "POST" && path === "sms") {
      const contentLength = req.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > 100_000) {
        return new Response(JSON.stringify({ error: "Payload too large" }), {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      if (!body || !Array.isArray(body.messages)) {
        return new Response(JSON.stringify({ error: "Invalid request body: expected { messages: [...] }" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let inserted = 0;
      for (const msg of body.messages.slice(0, 200)) {
        if (!isValidString(msg.phone_number, 30) || !isValidString(msg.direction, 20)) continue;

        const incomingPhoneRaw = msg.phone_number.trim().slice(0, 30);
        const normalizedIncomingPhone = normalizePhoneNumber(incomingPhoneRaw);

        // Try exact phone match first
        let { data: chip } = await supabase
          .from("chips")
          .select("id, modem_id, phone_number")
          .eq("phone_number", incomingPhoneRaw)
          .maybeSingle();

        // Fallback: match by normalized phone (handles +55 vs 55 formatting)
        if (!chip) {
          const { data: locationModems } = await supabase
            .from("modems")
            .select("id")
            .eq("location_id", location.id);

          const modemIds = (locationModems || []).map((m) => m.id);
          if (modemIds.length === 0) continue;

          const { data: locationChips } = await supabase
            .from("chips")
            .select("id, modem_id, phone_number")
            .in("modem_id", modemIds);

          chip = (locationChips || []).find(
            (c) => normalizePhoneNumber(c.phone_number) === normalizedIncomingPhone
          ) ?? null;
        }

        if (!chip) continue;

        // Verify chip belongs to this location
        const { data: modem } = await supabase
          .from("modems")
          .select("id")
          .eq("id", chip.modem_id)
          .eq("location_id", location.id)
          .single();

        if (!modem) continue;

        // Only persist SMS when there is an active/paid contracted order for this chip
        const { data: activeOrder } = await supabase
          .from("orders")
          .select("id, created_at")
          .eq("chip_id", chip.id)
          .in("status", ["active", "paid"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!activeOrder) continue;

        const receivedAt =
          typeof msg.received_at === "string" && !Number.isNaN(Date.parse(msg.received_at))
            ? new Date(msg.received_at).toISOString()
            : new Date().toISOString();

        // Ignore stale/backlog SMS older than the current contracted order
        if (new Date(receivedAt).getTime() < new Date(activeOrder.created_at).getTime()) continue;

        const { error: insertErr } = await supabase.from("sms_logs").insert({
          chip_id: chip.id,
          direction: sanitizeString(msg.direction, 20),
          sender: msg.sender ? msg.sender.trim().slice(0, 50) : null,
          recipient: msg.recipient ? msg.recipient.trim().slice(0, 50) : null,
          message: msg.message ? msg.message.slice(0, 500) : null,
          received_at: receivedAt,
        });

        if (!insertErr) inserted++;
      }

      return new Response(
        JSON.stringify({ success: true, inserted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /gsm-gateway - heartbeat + sync modems
    if (req.method === "POST" && (!path || path === "gsm-gateway")) {
      // Limit request body size
      const contentLength = req.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > 512_000) {
        return new Response(JSON.stringify({ error: "Payload too large" }), {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();

      if (!body || !Array.isArray(body.modems)) {
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const modems = body.modems;

      if (modems.length > 50) {
        return new Response(JSON.stringify({ error: "Too many modems (max 50)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const modem of modems) {
        // Validate modem fields
        if (!isValidString(modem.port_name, 100)) {
          return new Response(JSON.stringify({ error: "Invalid port_name" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!isValidString(modem.status, 30)) {
          return new Response(JSON.stringify({ error: "Invalid modem status" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!isValidSignalStrength(modem.signal_strength)) {
          return new Response(JSON.stringify({ error: "Invalid signal_strength" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const portName = sanitizeString(modem.port_name, 100);
        const modemStatus = sanitizeString(modem.status, 30);
        const imei = modem.imei && isValidString(modem.imei, 20) ? sanitizeString(modem.imei, 20) : null;
        const operator = modem.operator && isValidString(modem.operator, 50) ? sanitizeString(modem.operator, 50) : null;
        const signalStrength = typeof modem.signal_strength === "number" ? modem.signal_strength : null;

        // Upsert modem
        const { data: existingModem } = await supabase
          .from("modems")
          .select("id")
          .eq("location_id", location.id)
          .eq("port_name", portName)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        let modemId: string;

        if (existingModem) {
          modemId = existingModem.id;
          await supabase
            .from("modems")
            .update({
              imei,
              operator,
              signal_strength: signalStrength,
              status: modemStatus,
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", modemId);
        } else {
          const { data: newModem } = await supabase
            .from("modems")
            .insert({
              location_id: location.id,
              port_name: portName,
              imei,
              operator,
              signal_strength: signalStrength,
              status: modemStatus,
              last_seen_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          modemId = newModem!.id;
        }

        // Sync chips
        const chips = Array.isArray(modem.chips) ? modem.chips.slice(0, 100) : [];
        for (const chip of chips) {
          if (!isValidPhoneNumber(chip.phone_number)) continue;

          const phoneNumber = chip.phone_number.trim().slice(0, 30);
          const chipIccid = chip.iccid && isValidString(chip.iccid, 30) ? sanitizeString(chip.iccid, 30) : null;
          const chipOperator = chip.operator && isValidString(chip.operator, 50) ? sanitizeString(chip.operator, 50) : null;
          const chipStatus = chip.status && isValidString(chip.status, 20) ? sanitizeString(chip.status, 20) : "active";

          const { data: existingChip } = await supabase
            .from("chips")
            .select("id")
            .eq("modem_id", modemId)
            .eq("phone_number", phoneNumber)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (existingChip) {
            await supabase
              .from("chips")
              .update({
                iccid: chipIccid,
                operator: chipOperator,
                status: chipStatus,
              })
              .eq("id", existingChip.id);
          } else {
            await supabase.from("chips").insert({
              modem_id: modemId,
              phone_number: phoneNumber,
              iccid: chipIccid,
              operator: chipOperator,
              status: chipStatus,
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, location_id: location.id }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GSM Gateway error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
