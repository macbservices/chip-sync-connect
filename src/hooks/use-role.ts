import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "collaborator" | "customer";

export function useRole() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchRoles = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) { setRoles([]); setLoading(false); }
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (mounted) {
        setRoles((data || []).map((r) => r.role as AppRole));
        setLoading(false);
      }
    };

    fetchRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoles();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isCollaborator = roles.includes("collaborator");
  const isCustomer = roles.includes("customer");
  const hasAnyRole = roles.length > 0;

  return { roles, loading, isAdmin, isCollaborator, isCustomer, hasAnyRole };
}
