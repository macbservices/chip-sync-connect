import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Smartphone,
  ArrowLeft,
  Plus,
  Check,
  X,
  Eye,
  Package,
  DollarSign,
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
  customer_id: string;
  service_id: string;
  status: string;
  amount_cents: number;
  phone_number: string | null;
  pix_proof_url: string | null;
  admin_notes: string | null;
  created_at: string;
  service: { name: string; type: string } | null;
};

const AdminOrders = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "services">("orders");

  // New service form
  const [svcName, setSvcName] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcType, setSvcType] = useState<string>("verification");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcDuration, setSvcDuration] = useState("");
  const [svcDialogOpen, setSvcDialogOpen] = useState(false);

  // Order management
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderPhone, setOrderPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    fetchAll();
  };

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch own services
    const { data: svcData } = await supabase
      .from("services")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setServices(svcData || []);

    // Fetch orders for own services
    const { data: ordData } = await supabase
      .from("orders")
      .select("*, service:services(name, type)")
      .order("created_at", { ascending: false });
    setOrders((ordData as any) || []);
    setLoading(false);
  };

  const createService = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !svcName.trim() || !svcPrice.trim()) return;

    const { error } = await supabase.from("services").insert({
      user_id: user.id,
      name: svcName,
      description: svcDesc || null,
      type: svcType,
      price_cents: Math.round(parseFloat(svcPrice) * 100),
      duration_minutes: svcDuration ? parseInt(svcDuration) : null,
    });

    if (error) { toast.error("Erro ao criar serviço"); return; }
    toast.success("Serviço criado!");
    setSvcName(""); setSvcDesc(""); setSvcPrice(""); setSvcDuration("");
    setSvcDialogOpen(false);
    fetchAll();
  };

  const toggleService = async (id: string, isActive: boolean) => {
    await supabase.from("services").update({ is_active: !isActive }).eq("id", id);
    fetchAll();
  };

  const approveOrder = async (order: Order) => {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        phone_number: orderPhone || null,
        admin_notes: orderNotes || null,
      })
      .eq("id", order.id);

    if (error) { toast.error("Erro ao aprovar"); return; }
    toast.success("Pedido aprovado!");
    setOrderDialogOpen(false);
    fetchAll();
  };

  const cancelOrder = async (orderId: string) => {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    toast.success("Pedido cancelado");
    fetchAll();
  };

  const activateOrder = async (orderId: string) => {
    await supabase.from("orders").update({ status: "active" }).eq("id", orderId);
    toast.success("Pedido ativado!");
    fetchAll();
  };

  const completeOrder = async (orderId: string) => {
    await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
    toast.success("Pedido concluído!");
    fetchAll();
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Gestão de Vendas</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant={tab === "orders" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("orders")}
            >
              <Package className="mr-1 h-4 w-4" /> Pedidos
            </Button>
            <Button
              variant={tab === "services" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("services")}
            >
              <DollarSign className="mr-1 h-4 w-4" /> Serviços
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-6 space-y-6">
        {tab === "services" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Meus Serviços</CardTitle>
                <CardDescription>Serviços que aparecem na loja para clientes</CardDescription>
              </div>
              <Dialog open={svcDialogOpen} onOpenChange={setSvcDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Novo Serviço</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Serviço</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={svcName} onChange={(e) => setSvcName(e.target.value)} placeholder="Ex: Verificação WhatsApp" />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} placeholder="Descrição do serviço" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={svcType} onValueChange={setSvcType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="verification">Verificação Avulsa</SelectItem>
                          <SelectItem value="rental">Aluguel de Número</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Preço (R$)</Label>
                      <Input type="number" step="0.01" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)} placeholder="5.00" />
                    </div>
                    {svcType === "rental" && (
                      <div className="space-y-2">
                        <Label>Duração (minutos)</Label>
                        <Input type="number" value={svcDuration} onChange={(e) => setSvcDuration(e.target.value)} placeholder="60" />
                      </div>
                    )}
                    <Button onClick={createService} className="w-full">Criar Serviço</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum serviço criado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((svc) => (
                      <TableRow key={svc.id}>
                        <TableCell className="font-medium">{svc.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {svc.type === "verification" ? "Verificação" : "Aluguel"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatPrice(svc.price_cents)}</TableCell>
                        <TableCell>
                          <Badge variant={svc.is_active ? "default" : "secondary"}>
                            {svc.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleService(svc.id, svc.is_active)}
                          >
                            {svc.is_active ? "Desativar" : "Ativar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "orders" && (
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Recebidos</CardTitle>
              <CardDescription>Gerencie os pedidos dos clientes</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum pedido recebido.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.service?.name || "—"}
                        </TableCell>
                        <TableCell>{formatPrice(order.amount_cents)}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {order.phone_number || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {order.status === "pending_payment" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Aprovar"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setOrderPhone(order.phone_number || "");
                                    setOrderNotes(order.admin_notes || "");
                                    setOrderDialogOpen(true);
                                  }}
                                >
                                  <Check className="h-4 w-4 text-success" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Cancelar"
                                  onClick={() => cancelOrder(order.id)}
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            {order.status === "paid" && (
                              <Button size="sm" variant="outline" onClick={() => activateOrder(order.id)}>
                                Ativar
                              </Button>
                            )}
                            {order.status === "active" && (
                              <Button size="sm" variant="outline" onClick={() => completeOrder(order.id)}>
                                Concluir
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Approve order dialog */}
        <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar Pedido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Número atribuído ao cliente</Label>
                <Input
                  value={orderPhone}
                  onChange={(e) => setOrderPhone(e.target.value)}
                  placeholder="Ex: +5511999999999"
                />
              </div>
              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Observações internas"
                />
              </div>
              <Button onClick={() => selectedOrder && approveOrder(selectedOrder)} className="w-full">
                <Check className="mr-2 h-4 w-4" />
                Confirmar Aprovação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminOrders;
