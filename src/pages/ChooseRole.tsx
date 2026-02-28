import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Smartphone, RefreshCw } from "lucide-react";

const ChooseRole = () => {
  const [role, setRole] = useState<"customer" | "collaborator">("customer");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      // If user already has a role, redirect
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roleList = (roles || []).map((r) => r.role);
      if (roleList.length > 0) {
        if (roleList.includes("admin")) navigate("/admin", { replace: true });
        else if (roleList.includes("collaborator")) navigate("/dashboard", { replace: true });
        else navigate("/store", { replace: true });
        return;
      }
      setChecking(false);
    };
    check();
  }, [navigate]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const { error } = await supabase.from("user_roles").insert({
        user_id: session.user.id,
        role,
      });

      if (error) throw error;

      // Also ensure profile exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from("profiles").insert({
          user_id: session.user.id,
          full_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "",
        });
      }

      toast.success("Perfil configurado!");
      navigate(role === "collaborator" ? "/dashboard" : "/store", { replace: true });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Smartphone className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Escolha seu perfil</CardTitle>
          <CardDescription>
            Como você pretende usar o CHIP SMS?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={role}
            onValueChange={(v) => setRole(v as "customer" | "collaborator")}
            className="grid gap-4"
          >
            <Label
              htmlFor="choose-customer"
              className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${
                role === "customer" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value="customer" id="choose-customer" className="mt-1" />
              <div>
                <p className="font-semibold">Cliente</p>
                <p className="text-sm text-muted-foreground">
                  Compre verificações SMS, recarregue via PIX e acompanhe seus pedidos.
                </p>
              </div>
            </Label>
            <Label
              htmlFor="choose-collaborator"
              className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${
                role === "collaborator" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value="collaborator" id="choose-collaborator" className="mt-1" />
              <div>
                <p className="font-semibold">Colaborador</p>
                <p className="text-sm text-muted-foreground">
                  Gerencie chipeiras, acompanhe modems e receba comissões sobre vendas.
                </p>
              </div>
            </Label>
          </RadioGroup>
          <Button onClick={handleSubmit} className="w-full" disabled={loading}>
            {loading ? "Aguarde..." : "Continuar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChooseRole;
