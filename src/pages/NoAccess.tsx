import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NoAccess = () => {
  const navigate = useNavigate();

  const handleBack = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { navigate("/auth"); return; }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.session.user.id);

    const roleList = (roles || []).map((r) => r.role);
    if (roleList.includes("admin")) navigate("/admin");
    else if (roleList.includes("collaborator")) navigate("/dashboard");
    else if (roleList.includes("customer")) navigate("/store");
    else navigate("/auth");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-5 max-w-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Acesso negado</h1>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta área. Retorne para a sua área de acesso.
        </p>
        <Button onClick={handleBack} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para minha área
        </Button>
      </div>
    </div>
  );
};

export default NoAccess;
