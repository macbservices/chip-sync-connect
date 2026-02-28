import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Smartphone } from "lucide-react";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const initialRole = searchParams.get("role") === "collaborator" ? "collaborator" : "customer";
  const [role, setRole] = useState<"customer" | "collaborator">(initialRole);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const redirectAfterLogin = async (userId: string) => {
    // Check role and redirect accordingly
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roleList = (roles || []).map((r) => r.role);
    const redirect = searchParams.get("redirect");

    if (redirect) {
      navigate(redirect);
    } else if (roleList.includes("admin")) {
      navigate("/admin");
    } else if (roleList.includes("collaborator")) {
      navigate("/dashboard");
    } else if (roleList.includes("customer")) {
      navigate("/store");
    } else {
      // No role yet — assign customer by default after signup
      navigate("/store");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await redirectAfterLogin(data.user.id);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        if (data.user && !data.user.email_confirmed_at) {
          toast.success("Conta criada! Verifique seu e-mail para confirmar.");
        } else if (data.user) {
          // Auto-confirmed — redirect based on chosen role
          navigate(role === "collaborator" ? "/dashboard" : "/store");
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Smartphone className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">CHIP SMS</CardTitle>
          <CardDescription>
            {isLogin ? "Entre na sua conta" : "Crie sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    required={!isLogin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de conta</Label>
                  <RadioGroup
                    value={role}
                    onValueChange={(v) => setRole(v as "customer" | "collaborator")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="customer" id="role-customer" />
                      <Label htmlFor="role-customer" className="cursor-pointer font-normal">Cliente</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="collaborator" id="role-collaborator" />
                      <Label htmlFor="role-collaborator" className="cursor-pointer font-normal">Colaborador</Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary underline-offset-4 hover:underline"
            >
              {isLogin ? "Criar conta" : "Entrar"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
