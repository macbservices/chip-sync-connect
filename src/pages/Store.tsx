import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Clock, Zap, ShoppingCart, LogIn } from "lucide-react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price_cents: number;
  duration_minutes: number | null;
  is_active: boolean;
};

const Store = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    fetchServices();
  }, []);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("price_cents");
    setServices(data || []);
    setLoading(false);
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const handleBuy = (serviceId: string) => {
    if (!session) {
      navigate("/auth?redirect=/store");
      return;
    }
    navigate(`/order/${serviceId}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">CHIP SMS</span>
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/my-orders")}>
                  Meus Pedidos
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                  Dashboard
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => navigate("/auth?redirect=/store")}>
                <LogIn className="mr-2 h-4 w-4" />
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container py-12">
          <div className="mx-auto max-w-3xl text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
              Serviços de SMS & Verificação
            </h1>
            <p className="text-lg text-muted-foreground">
              Alugue números ou receba códigos de verificação por SMS de forma rápida e segura.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingCart className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg">Nenhum serviço disponível no momento.</p>
              <p className="text-sm mt-1">Volte em breve!</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <Card key={service.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant={service.type === "verification" ? "default" : "secondary"}>
                        {service.type === "verification" ? (
                          <><Zap className="mr-1 h-3 w-3" /> Verificação</>
                        ) : (
                          <><Clock className="mr-1 h-3 w-3" /> Aluguel</>
                        )}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2">{service.name}</CardTitle>
                    {service.description && (
                      <CardDescription>{service.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1">
                    {service.type === "rental" && service.duration_minutes && (
                      <p className="text-sm text-muted-foreground">
                        Duração: {service.duration_minutes >= 60
                          ? `${Math.floor(service.duration_minutes / 60)}h${service.duration_minutes % 60 > 0 ? ` ${service.duration_minutes % 60}min` : ""}`
                          : `${service.duration_minutes} min`}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(service.price_cents)}
                    </span>
                    <Button onClick={() => handleBuy(service.id)}>
                      Comprar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Store;
