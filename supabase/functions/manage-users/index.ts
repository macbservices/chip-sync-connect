import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller using their JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: userError } =
      await callerClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = callerUser.id;

    // Check admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "list") {
      // List all users with roles and balances
      const { data: users, error } =
        await adminClient.auth.admin.listUsers({ perPage: 500 });
      if (error) throw error;

      const userIds = users.users.map((u) => u.id);

      const [{ data: roles }, { data: profiles }] = await Promise.all([
        adminClient.from("user_roles").select("user_id, role").in("user_id", userIds),
        adminClient.from("profiles").select("user_id, full_name, balance_cents").in("user_id", userIds),
      ]);

      const result = users.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        full_name: profiles?.find((p) => p.user_id === u.id)?.full_name || null,
        balance_cents: profiles?.find((p) => p.user_id === u.id)?.balance_cents ?? 0,
        roles: (roles || []).filter((r) => r.user_id === u.id).map((r) => r.role),
      }));

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { email, password, full_name, role } = body;
      if (!email || !password || password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Email e senha (min 6 chars) obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validRoles = ["admin", "collaborator", "customer"];
      const assignRole = validRoles.includes(role) ? role : "customer";

      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name || "" },
        });

      if (createError) throw createError;

      // Assign role
      await adminClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role: assignRole,
      });

      return new Response(
        JSON.stringify({ id: newUser.user.id, email: newUser.user.email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id || user_id === callerId) {
        return new Response(
          JSON.stringify({ error: "ID inválido ou não pode deletar a si mesmo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { user_id, role } = body;
      const validRoles = ["admin", "collaborator", "customer"];
      if (!user_id || !validRoles.includes(role)) {
        return new Response(
          JSON.stringify({ error: "Dados inválidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Remove existing roles and set new one
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("user_roles").insert({ user_id, role });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
