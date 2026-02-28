import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Smartphone, Zap, Shield, Clock, Users, ChevronRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
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
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">CHIP SMS</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/auth")} size="sm">
              Entrar
            </Button>
            <Button onClick={() => navigate("/auth?mode=signup")} size="sm">
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="flex flex-col items-center justify-center px-4 text-center py-24 sm:py-32 space-y-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Verificação SMS instantânea
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Números reais.{" "}
              <span className="text-primary">Códigos na hora.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto">
              Compre verificações de SMS usando chips físicos reais. Rápido, seguro e sem burocracia.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="px-8 gap-2" onClick={() => navigate("/auth?mode=signup")}>
              Começar agora
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="px-8" onClick={() => navigate("/auth")}>
              Já tenho conta
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 py-16 sm:py-20">
          <div className="container">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
              Por que usar o CHIP SMS?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Zap, title: "Instantâneo", desc: "Código SMS recebido em segundos após a compra" },
                { icon: Shield, title: "Seguro", desc: "Chips físicos reais, sem números virtuais" },
                { icon: Clock, title: "24/7", desc: "Serviço disponível a qualquer hora do dia" },
                { icon: Users, title: "Colaboradores", desc: "Gerencie chipeiras e ganhe comissões" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-semibold text-lg">{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA for roles */}
        <section className="py-16 sm:py-20">
          <div className="container max-w-4xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-xl border bg-card p-8 space-y-4 shadow-sm">
                <h3 className="text-xl font-bold">Sou Cliente</h3>
                <p className="text-sm text-muted-foreground">
                  Compre verificações SMS, recarregue via PIX e acompanhe seus pedidos em tempo real.
                </p>
                <Button className="w-full" onClick={() => navigate("/auth?mode=signup&role=customer")}>
                  Criar conta de Cliente
                </Button>
              </div>
              <div className="rounded-xl border bg-card p-8 space-y-4 shadow-sm">
                <h3 className="text-xl font-bold">Sou Colaborador</h3>
                <p className="text-sm text-muted-foreground">
                  Gerencie suas chipeiras, acompanhe modems em tempo real e receba comissões sobre vendas.
                </p>
                <Button variant="outline" className="w-full" onClick={() => navigate("/auth?mode=signup&role=collaborator")}>
                  Criar conta de Colaborador
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CHIP SMS — Todos os direitos reservados
      </footer>
    </div>
  );
};

export default Index;
