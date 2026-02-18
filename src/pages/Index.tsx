import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard");
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center space-y-6 px-4 max-w-sm">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Smartphone className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold">CHIP SMS</h1>
          <p className="text-muted-foreground mt-2">
            Verificação por SMS rápida e confiável
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={() => navigate("/auth")}>
            Entrar / Cadastrar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
