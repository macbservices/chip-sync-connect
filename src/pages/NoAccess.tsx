import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

const NoAccess = () => {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <ShieldX className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Acesso negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        <Button onClick={() => navigate("/dashboard")}>Voltar</Button>
      </div>
    </div>
  );
};

export default NoAccess;
