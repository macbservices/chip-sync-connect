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
  Wallet, Plus, RefreshCw, MessageSquare, Copy, AlertCircle
} from "lucide-react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price_cents: number;
  duration_minutes: number | null;
  is_active: boolean;
  available_chips?: number;
};

type Order = {
  id: string;
  status: string;
  amount_cents: number;
  phone_number: string | null;
  chip_id: string | null;
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
  const { isAdmin, loading: roleLoading } = useRole();
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
  const [smsLoading, setSmsLoading] = useState(false);

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

  // Realtime SMS polling when popup is open
  useEffect(() => {
    if (!activeSmsOrder || !smsPopupOpen) return;
    const interval = setInterval(() => loadSmsCodes(activeSmsOrder), 5000);
    return () => clearInterval(interval);
  }, [activeSmsOrder, smsPopupOpen]);

  const fetchAll = async (userId: string) => {
    const [{ data: svcData }, { data: ordData }, { data: profileData }] = await Promise.all([
      supabase.from("public_services").select("*").order("price_cents"),
      supabase.from("orders")
        .select("id, status, amount_cents, phone_number, chip_id, created_at, service:services(name, type)")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("balance_cents").eq("user_id", userId).single(),
    ]);
    setServices(svcData || []);
    setOrders((ordData as any) || []);
    setBalance(profileData?.balance_cents ?? 0);
    setLoading(false);
  };

  const loadSmsCodes = async (order: Order) => {
    if (!order.chip_id) return;
    setSmsLoading(true);
    const { data: sms } = await supabase
      .from("sms_logs")
      .select("id, sender, message, received_at")
      .eq("chip_id", order.chip_id)
      .eq("direction", "inbound")
      .order("received_at", { ascending: false })
      .limit(20);
    setSmsCodes((sms as any) || []);
    setSmsLoading(false);
  };

  const openSmsPopup = async (order: Order) => {
    setActiveSmsOrder(order);
    setSmsCodes([]);
    setSmsPopupOpen(true);
    await loadSmsCodes(order);
  };

  const buyService = async (service: Service) => {
    if (!session) { navigate("/auth"); return; }
    if (balance < service.price_cents) {
      toast.error("Saldo insuficiente. Recarregue sua conta via PIX.");
      return;
    }

    setBuying(service.id);
    try {
      const { error } = await supabase.rpc("purchase_service", { _service_id: service.id });
      if (error) throw error;

      toast.success("Pedido criado! O número será atribuído em instantes.");
      await fetchAll(session.user.id);
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
      pending_payment: { label: "Aguardando número", variant: "outline" },
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
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">CHIP SMS</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Balance */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border bg-muted px-3 py-1.5 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-primary" />
              {formatPrice(balance)}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/recharge")}>
              <Plus className="mr-1 h-3 w-3" />
              Recarregar
            </Button>
            <Button
              variant={tab === "history" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("history")}
            >
              <History className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                Admin
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">

        {/* Balance card on mobile */}
        <div className="sm:hidden mb-6">
          <div className="flex items-center justify-between rounded-xl border bg-primary/5 px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Saldo disponível</p>
              <p className="text-xl font-bold text-primary">{formatPrice(balance)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/recharge")}>
              <Plus className="h-3 w-3 mr-1" /> Recarregar
            </Button>
          </div>
        </div>

        {/* Store Tab */}
        {tab === "store" && (
          <>
            <div className="mx-auto max-w-3xl text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Serviços disponíveis</h1>
              <p className="text-muted-foreground">
                Escolha um serviço e receba o código SMS em segundos
              </p>
            </div>

            {services.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="mx-auto h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Nenhum serviço disponível no momento.</p>
                <p className="text-sm mt-1">Volte em breve.</p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                {services.map((service) => (
                  <Card key={service.id} className="flex flex-col hover:shadow-md transition-shadow border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge variant={service.type === "verification" ? "default" : "secondary"} className="text-xs">
                          {service.type === "verification" ? (
                            <><Zap className="mr-1 h-3 w-3" /> Verificação</>
                          ) : (
                            <><Clock className="mr-1 h-3 w-3" /> Aluguel</>
                          )}
                        </Badge>
                      </div>
                      <CardTitle className="mt-2 text-lg">{service.name}</CardTitle>
                      {service.description && (
                        <CardDescription className="text-sm">{service.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 pb-3">
                      {service.type === "rental" && service.duration_minutes && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {service.duration_minutes >= 60
                            ? `${Math.floor(service.duration_minutes / 60)}h${service.duration_minutes % 60 > 0 ? ` ${service.duration_minutes % 60}min` : ""}`
                            : `${service.duration_minutes} min`}
                        </p>
                      )}
                    </CardContent>
                    <CardFooter className="flex items-center justify-between pt-3 border-t">
                      <span className="text-2xl font-extrabold text-primary">
                        {formatPrice(service.price_cents)}
                      </span>
                      <Button
                        onClick={() => buyService(service)}
                        disabled={buying === service.id}
                        size="sm"
                        className="shrink-0"
                      >
                        {buying === service.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : balance < service.price_cents ? (
                          "Saldo insuficiente"
                        ) : (
                          <><ShoppingCart className="mr-1.5 h-4 w-4" /> Comprar</>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold">Meus Pedidos</h2>
              <Button variant="outline" size="sm" onClick={() => setTab("store")}>
                Ver serviços
              </Button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <History className="mx-auto h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Nenhum pedido ainda.</p>
                <Button className="mt-4" onClick={() => setTab("store")}>
                  Explorar serviços
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <Card key={order.id} className="border-border/60">
                    <CardContent className="flex items-center justify-between p-4 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{order.service?.name || "—"}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleString("pt-BR")}
                        </p>
                        {order.phone_number && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Smartphone className="h-3.5 w-3.5 text-primary" />
                            <p className="text-sm font-mono font-bold text-primary">
                              {order.phone_number}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => {
                                navigator.clipboard.writeText(order.phone_number!);
                                toast.success("Número copiado!");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {order.status === "pending_payment" && !order.phone_number && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Aguardando atribuição de número...
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-primary">{formatPrice(order.amount_cents)}</p>
                          <div className="mt-0.5">{getStatusBadge(order.status)}</div>
                        </div>
                        {(order.status === "active" || order.status === "paid") && order.chip_id && (
                          <Button size="sm" variant="outline" onClick={() => openSmsPopup(order)}>
                            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
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
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Mensagens SMS recebidas
            </DialogTitle>
          </DialogHeader>

          {activeSmsOrder?.phone_number && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 px-4 py-3 text-center space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Número do chip</p>
              <div className="flex items-center justify-center gap-2">
                <p className="font-mono font-bold text-primary text-xl">{activeSmsOrder.phone_number}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    navigator.clipboard.writeText(activeSmsOrder.phone_number!);
                    toast.success("Número copiado!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie o código de verificação para este número
              </p>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto space-y-2">
            {smsLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : smsCodes.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma mensagem recebida ainda.</p>
                <p className="text-xs mt-1 text-muted-foreground">Atualizando automaticamente a cada 5s...</p>
              </div>
            ) : (
              smsCodes.map((sms) => (
                <div key={sms.id} className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      De: {sms.sender || "Desconhecido"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(sms.received_at).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm font-medium bg-muted rounded px-2 py-1 font-mono">{sms.message}</p>
                </div>
              ))
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Atualizando automaticamente a cada 5 segundos
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Store;
