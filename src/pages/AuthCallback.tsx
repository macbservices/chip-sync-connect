import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Wait for session to be available after OAuth redirect
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user already has a role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roleList = (roles || []).map((r) => r.role);

      if (roleList.length === 0) {
        // New user from Google — needs role selection
        navigate("/escolher-perfil", { replace: true });
      } else if (roleList.includes("admin")) {
        navigate("/admin", { replace: true });
      } else if (roleList.includes("collaborator")) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/store", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default AuthCallback;
