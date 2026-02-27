import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "collaborator" | "customer";

interface RouteGuardProps {
  allowedRoles: AppRole[];
  redirectTo?: string;
  children: React.ReactNode;
}

export const RouteGuard = ({ allowedRoles, redirectTo = "/auth", children }: RouteGuardProps) => {
  const { roles, loading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate(redirectTo, { replace: true });
        return;
      }

      const hasAccess = allowedRoles.some((r) => roles.includes(r));
      if (!hasAccess && roles.length > 0) {
        navigate("/sem-acesso", { replace: true });
      }
    });
  }, [loading, roles, allowedRoles, navigate, redirectTo]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasAccess = allowedRoles.some((r) => roles.includes(r));
  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
};
