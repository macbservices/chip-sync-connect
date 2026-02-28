import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Smartphone, Zap, Shield, Clock } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      // Redirect logged-in users to their area
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id);
      const roleList = (roles || []).map((r) => r.role);
      if (roleList.includes("admin")) navigate("/admin");
      else if (roleList.includes("collaborator")) navigate("/colaborador");
      else navigate("/store");
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">CHIP SMS</span>
          </div>
          <Button onClick={() => navigate("/auth")} size="sm">
            Entrar
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center py-20 space-y-10">
        <div className="space-y-4 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            Verificação SMS instantânea
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Números reais.<br />
            <span className="text-primary">Códigos na hora.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-sm mx-auto">
            Compre verificações de SMS usando chips físicos reais. Rápido, seguro e sem burocracia.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" className="px-8" onClick={() => navigate("/auth")}>
            Começar agora
          </Button>
          <Button size="lg" variant="outline" className="px-8" onClick={() => navigate("/auth")}>
            Já tenho conta
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full mt-8">
          {[
            { icon: Zap, title: "Instantâneo", desc: "Código recebido em segundos" },
            { icon: Shield, title: "Seguro", desc: "Chips físicos reais, sem intermediários" },
            { icon: Clock, title: "Disponível", desc: "Serviço 24h, 7 dias por semana" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CHIP SMS — Todos os direitos reservados
      </footer>
    </div>
  );
};

export default Index;
