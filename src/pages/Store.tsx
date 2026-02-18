import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Smartphone, Clock, Zap, ShoppingCart, LogOut, History,
  Wallet, Plus, RefreshCw
} from "lucide-react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price_cents: number;
  duration_minutes: number | null;
  is_active: boolean;
};

type Order = {
  id: string;
  status: string;
  amount_cents: number;
  phone_number: string | null;
  created_at: string;
  service: { name: string; type: string } | null;
};

type SmsCode = {
  id: string;
  sender: string | null;
  message: string | null;
  received_at: string;
};

const Store = () => {
  const navigate = useNavigate();
  const { isCustomer, isAdmin, loading: roleLoading } = useRole();
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [tab, setTab] = useState<"store" | "history">("store");
  const [buying, setBuying] = useState<string | null>(null);

  // SMS popup
  const [smsPopupOpen, setSmsPopupOpen] = useState(false);
  const [activeSmsOrder, setActiveSmsOrder] = useState<Order | null>(null);
  const [smsCodes, setSmsCodes] = useState<SmsCode[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/auth"); return; }
      setSession(data.session);
      fetchAll(data.session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime: listen for new SMS on active order chip
  useEffect(() => {
    if (!activeSmsOrder || !smsPopupOpen) return;
    // We poll every 5s since we don't have direct chip_id from order easily
    const interval = setInterval(() => loadSmsCodes(activeSmsOrder), 5000);
    return () => clearInterval(interval);
  }, [activeSmsOrder, smsPopupOpen]);

  const fetchAll = async (userId: string) => {
    const [{ data: svcData }, { data: ordData }, { data: profileData }] = await Promise.all([
      supabase.from("services").select("*").eq("is_active", true).order("price_cents"),
      supabase.from("orders").select("*, service:services(name, type)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("balance_cents").eq("user_id", userId).single(),
    ]);
    setServices(svcData || []);
    setOrders((ordData as any) || []);
    setBalance(profileData?.balance_cents ?? 0);
    setLoading(false);
  };

  const loadSmsCodes = async (order: Order) => {
    // Fetch sms via chip linked to this order's chip_id
    const { data: orderDetail } = await supabase
      .from("orders")
      .select("chip_id")
      .eq("id", order.id)
      .single();

    if (!orderDetail?.chip_id) return;

    const { data: sms } = await supabase
      .from("sms_logs")
      .select("id, sender, message, received_at")
      .eq("chip_id", orderDetail.chip_id)
      .eq("direction", "inbound")
      .order("received_at", { ascending: false })
      .limit(20);

    setSmsCodes((sms as any) || []);
  };

  const openSmsPopup = async (order: Order) => {
    setActiveSmsOrder(order);
    setSmsPopupOpen(true);
    await loadSmsCodes(order);
  };

  const buyService = async (service: Service) => {
    if (!session) { navigate("/auth"); return; }
    if (balance < service.price_cents) {
      toast.error("Saldo insuficiente. Faça uma recarga primeiro.");
      return;
    }
    setBuying(service.id);
    try {
      const { error } = await supabase.from("orders").insert({
        customer_id: session.user.id,
        service_id: service.id,
        amount_cents: service.price_cents,
        status: "pending_payment",
      });
      if (error) throw error;
      toast.success("Pedido criado! Aguarde a atribuição do número pelo administrador.");
      fetchAll(session.user.id);
      setTab("history");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
    } finally {
      setBuying(null);
    }
  };

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending_payment: { label: "Aguardando", variant: "outline" },
      paid: { label: "Pago", variant: "default" },
      active: { label: "Ativo", variant: "default" },
      completed: { label: "Concluído", variant: "secondary" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">CHIP SMS</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Balance display */}
            <div className="flex items-center gap-1 rounded-lg border bg-muted px-3 py-1.5 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-primary" />
              {formatPrice(balance)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/recharge")}
            >
              <Plus className="mr-1 h-3 w-3" />
              Recarregar
            </Button>
            <Button
              variant={tab === "history" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("history")}
            >
              <History className="mr-1 h-4 w-4" />
              Histórico
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                Admin
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        {tab === "store" && (
          <>
            <div className="mx-auto max-w-3xl text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Serviços de SMS</h1>
              <p className="text-muted-foreground">
                Compre com seu saldo — verificação ou aluguel de número
              </p>
            </div>

            {services.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Nenhum serviço disponível no momento.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                {services.map((service) => (
                  <Card key={service.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-center gap-2">
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
                      <Button
                        onClick={() => buyService(service)}
                        disabled={buying === service.id || balance < service.price_cents}
                      >
                        {buying === service.id ? "Comprando..." : balance < service.price_cents ? "Saldo insuficiente" : "Comprar"}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Histórico de Pedidos</h2>
              <Button variant="outline" size="sm" onClick={() => setTab("store")}>
                Ver serviços
              </Button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <History className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Nenhum pedido ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{order.service?.name || "—"}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleString("pt-BR")}
                        </p>
                        {order.phone_number && (
                          <p className="text-sm font-mono text-primary mt-1">
                            📱 {order.phone_number}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div className="text-right">
                          <p className="font-bold text-primary">{formatPrice(order.amount_cents)}</p>
                          {getStatusBadge(order.status)}
                        </div>
                        {(order.status === "active" || order.status === "paid") && order.phone_number && (
                          <Button size="sm" onClick={() => openSmsPopup(order)}>
                            Ver SMS
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* SMS Code Popup */}
      <Dialog open={smsPopupOpen} onOpenChange={setSmsPopupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📱 SMS Recebidos</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {activeSmsOrder?.phone_number && (
              <div className="rounded-lg bg-muted px-4 py-2 text-center">
                <p className="text-xs text-muted-foreground">Número do chip</p>
                <p className="font-mono font-bold text-primary text-lg">{activeSmsOrder.phone_number}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Envie o código de verificação para este número
                </p>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto space-y-2 mt-2">
              {smsCodes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Nenhuma mensagem recebida ainda.<br />
                  Atualizando automaticamente a cada 5s...
                </p>
              ) : (
                smsCodes.map((sms) => (
                  <div key={sms.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        De: {sms.sender || "Desconhecido"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(sms.received_at).toLocaleTimeString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{sms.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Store;
