import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Smartphone, Plus, Check, X, Package, DollarSign,
  Wallet, Pencil, Trash2, RefreshCw, LogOut, AlertTriangle, Users, BanknoteIcon, RotateCcw
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
  chip_id: string | null;
  admin_notes: string | null;
  created_at: string;
  service: { name: string; type: string } | null;
};

type RechargeRequest = {
  id: string;
  user_id: string;
  amount_cents: number;
  status: string;
  pix_proof_url: string | null;
  admin_notes: string | null;
  created_at: string;
};

type Chip = {
  id: string;
  phone_number: string;
  operator: string | null;
  status: string;
};

type UserEntry = {
  id: string;
  email: string;
  full_name: string | null;
  balance_cents: number;
  roles: string[];
  created_at: string;
};

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useRole();
  const [tab, setTab] = useState<"orders" | "services" | "recharges" | "users">("orders");
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [loading, setLoading] = useState(true);

  // Service form
  const [svcDialogOpen, setSvcDialogOpen] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Service | null>(null);
  const [svcName, setSvcName] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcType, setSvcType] = useState("verification");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcDuration, setSvcDuration] = useState("");

  // Order management
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderPhone, setOrderPhone] = useState("");
  const [orderChipId, setOrderChipId] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  // User management
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("customer");

  // Balance dialog
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceUser, setBalanceUser] = useState<UserEntry | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin) { navigate("/sem-acesso"); return; }
    fetchAll();
  }, [isAdmin, roleLoading]);

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Also trigger auto-cancel of stale orders
    supabase.rpc("auto_cancel_stale_orders").then(({ data, error }) => {
      if (!error && data && data > 0) {
        toast.info(`${data} pedido(s) auto-cancelado(s) por falta de SMS`);
      }
    });

    const [{ data: svcData }, { data: ordData }, { data: rechData }, { data: chipData }] = await Promise.all([
      supabase.from("services").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*, service:services(name, type)").order("created_at", { ascending: false }),
      supabase.from("recharge_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("chips").select("id, phone_number, operator, status").in("status", ["active"]),
    ]);

    setServices(svcData || []);
    setOrders((ordData as any) || []);
    setRecharges((rechData as any) || []);
    setChips((chipData as any) || []);
    setLoading(false);
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "list" },
    });
    if (error) { toast.error("Erro ao carregar usuários"); setUsersLoading(false); return; }
    setUsers(data || []);
    setUsersLoading(false);
  };

  useEffect(() => {
    if (tab === "users" && users.length === 0) fetchUsers();
  }, [tab]);

  const openServiceDialog = (svc?: Service) => {
    if (svc) {
      setEditingSvc(svc);
      setSvcName(svc.name);
      setSvcDesc(svc.description || "");
      setSvcType(svc.type);
      setSvcPrice((svc.price_cents / 100).toString());
      setSvcDuration(svc.duration_minutes?.toString() || "");
    } else {
      setEditingSvc(null);
      setSvcName(""); setSvcDesc(""); setSvcType("verification"); setSvcPrice(""); setSvcDuration("");
    }
    setSvcDialogOpen(true);
  };

  const saveService = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !svcName.trim() || !svcPrice.trim()) {
      toast.error("Preencha o nome e o preço do serviço");
      return;
    }

    const payload = {
      user_id: user.id,
      name: svcName.trim(),
      description: svcDesc.trim() || null,
      type: svcType,
      price_cents: Math.round(parseFloat(svcPrice) * 100),
      duration_minutes: svcDuration ? parseInt(svcDuration) : null,
    };

    let error;
    if (editingSvc) {
      ({ error } = await supabase.from("services").update(payload).eq("id", editingSvc.id));
    } else {
      ({ error } = await supabase.from("services").insert(payload));
    }

    if (error) { toast.error("Erro ao salvar serviço"); return; }
    toast.success(editingSvc ? "Serviço atualizado!" : "Serviço criado!");
    setSvcDialogOpen(false);
    fetchAll();
  };

  const deleteService = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir serviço"); return; }
    toast.success("Serviço excluído");
    fetchAll();
  };

  const toggleService = async (id: string, isActive: boolean) => {
    await supabase.from("services").update({ is_active: !isActive }).eq("id", id);
    fetchAll();
  };

  const approveOrder = async () => {
    if (!selectedOrder) return;

    if (!orderChipId && !orderPhone) {
      toast.error("Selecione um chip ou informe um número");
      return;
    }

    let phoneToUse = orderPhone;
    if (orderChipId && !phoneToUse) {
      const chip = chips.find((c) => c.id === orderChipId);
      phoneToUse = chip?.phone_number || "";
    }

    const { error } = await supabase.from("orders").update({
      status: "active",
      phone_number: phoneToUse || null,
      chip_id: orderChipId || null,
      admin_notes: orderNotes || null,
    }).eq("id", selectedOrder.id);

    if (error) { toast.error("Erro ao aprovar pedido"); return; }
    toast.success("Pedido ativado! O cliente já pode ver o número.");
    setOrderDialogOpen(false);
    fetchAll();
  };

  const cancelOrder = async (order: Order) => {
    const { error } = await supabase.rpc("cancel_order_refund", { _order_id: order.id });
    if (error) { toast.error("Erro ao cancelar pedido"); return; }
    toast.success("Pedido cancelado e valor estornado ao cliente");
    fetchAll();
  };

  const cancelOrderReturnChip = async (order: Order) => {
    if (!confirm("Cancelar pedido, estornar saldo e devolver chip para venda?")) return;
    const { error } = await supabase.rpc("admin_cancel_order_return_chip", { _order_id: order.id });
    if (error) { toast.error("Erro ao cancelar: " + error.message); return; }
    toast.success("Pedido cancelado, saldo estornado e chip devolvido!");
    fetchAll();
  };

  const completeOrder = async (id: string) => {
    await supabase.from("orders").update({ status: "completed" }).eq("id", id);
    toast.success("Pedido concluído!");
    fetchAll();
  };

  const approveRecharge = async (r: RechargeRequest) => {
    const { error } = await supabase.rpc("approve_recharge", { _recharge_id: r.id });
    if (error) { toast.error("Erro ao aprovar recarga"); return; }
    toast.success("Recarga aprovada e saldo creditado!");
    fetchAll();
  };

  const rejectRecharge = async (r: RechargeRequest) => {
    await supabase.from("recharge_requests").update({ status: "rejected" }).eq("id", r.id);
    toast.success("Recarga rejeitada");
    fetchAll();
  };

  const addBalance = async () => {
    if (!balanceUser || !balanceAmount) return;
    const cents = Math.round(parseFloat(balanceAmount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "add_balance", user_id: balanceUser.id, amount_cents: cents },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao adicionar saldo");
      return;
    }
    toast.success(`Saldo adicionado! Novo saldo: ${formatPrice(data.new_balance)}`);
    setBalanceDialogOpen(false);
    setBalanceAmount("");
    fetchUsers();
  };

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending_payment: { label: "Aguardando", variant: "outline" },
      pending: { label: "Pendente", variant: "outline" },
      paid: { label: "Pago", variant: "default" },
      active: { label: "Ativo", variant: "default" },
      approved: { label: "Aprovado", variant: "default" },
      completed: { label: "Concluído", variant: "secondary" },
      cancelled: { label: "Cancelado", variant: "destructive" },
      rejected: { label: "Rejeitado", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === "pending_payment").length;
  const pendingRecharges = recharges.filter(r => r.status === "pending").length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">CHIP SMS</span>
            <span className="hidden sm:inline text-muted-foreground text-sm">— Painel Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant={tab === "orders" ? "default" : "ghost"} size="sm" onClick={() => setTab("orders")} className="relative">
              <Package className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
              {pendingOrders > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                  {pendingOrders}
                </span>
              )}
            </Button>
            <Button variant={tab === "recharges" ? "default" : "ghost"} size="sm" onClick={() => setTab("recharges")} className="relative">
              <Wallet className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Recargas</span>
              {pendingRecharges > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                  {pendingRecharges}
                </span>
              )}
            </Button>
            <Button variant={tab === "services" ? "default" : "ghost"} size="sm" onClick={() => setTab("services")}>
              <DollarSign className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Serviços</span>
            </Button>
            <Button variant={tab === "users" ? "default" : "ghost"} size="sm" onClick={() => setTab("users")}>
              <Users className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-6 space-y-6">

        {/* ====== SERVICES TAB ====== */}
        {tab === "services" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gerenciar Serviços</CardTitle>
                <CardDescription>Adicione, edite ou remova serviços da loja</CardDescription>
              </div>
              <Button size="sm" onClick={() => openServiceDialog()}>
                <Plus className="mr-2 h-4 w-4" /> Novo Serviço
              </Button>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <DollarSign className="mx-auto h-10 w-10 mb-3 opacity-30" />
                  <p>Nenhum serviço cadastrado.</p>
                  <Button size="sm" className="mt-4" onClick={() => openServiceDialog()}>
                    <Plus className="mr-1 h-4 w-4" /> Criar primeiro serviço
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
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
                        <TableCell className="font-semibold">{formatPrice(svc.price_cents)}</TableCell>
                        <TableCell>
                          <Badge variant={svc.is_active ? "default" : "secondary"}>
                            {svc.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openServiceDialog(svc)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => toggleService(svc.id, svc.is_active)} title={svc.is_active ? "Desativar" : "Ativar"}>
                              {svc.is_active ? <X className="h-4 w-4 text-muted-foreground" /> : <Check className="h-4 w-4 text-accent" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteService(svc.id)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

        {/* ====== ORDERS TAB ====== */}
        {tab === "orders" && (
          <Card>
            <CardHeader>
              <CardTitle>Pedidos dos Clientes</CardTitle>
              <CardDescription>Atribua um chip ao pedido para ativá-lo. Pedidos sem SMS são cancelados automaticamente após 10 min.</CardDescription>
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
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.service?.name || "—"}</TableCell>
                        <TableCell>{formatPrice(order.amount_cents)}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="font-mono text-sm">{order.phone_number || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {order.status === "pending_payment" && (
                              <>
                                <Button
                                  variant="ghost" size="icon" title="Atribuir chip e ativar"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setOrderPhone(order.phone_number || "");
                                    setOrderChipId(order.chip_id || "");
                                    setOrderNotes(order.admin_notes || "");
                                    setOrderDialogOpen(true);
                                  }}
                                >
                                  <Check className="h-4 w-4 text-accent" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Cancelar e estornar" onClick={() => cancelOrder(order)}>
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            {order.status === "active" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => completeOrder(order.id)}>
                                  Concluir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Cancelar, estornar e devolver chip"
                                  onClick={() => cancelOrderReturnChip(order)}
                                >
                                  <RotateCcw className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
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

        {/* ====== RECHARGES TAB ====== */}
        {tab === "recharges" && (
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Recarga PIX</CardTitle>
              <CardDescription>Confirme os pagamentos PIX e credite o saldo dos clientes</CardDescription>
            </CardHeader>
            <CardContent>
              {recharges.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma solicitação recebida.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Comprovante</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recharges.map((r) => (
                      <TableRow key={r.id} className={r.status === "pending" ? "bg-warning/5" : ""}>
                        <TableCell className="font-bold text-primary">{formatPrice(r.amount_cents)}</TableCell>
                        <TableCell>{getStatusBadge(r.status)}</TableCell>
                        <TableCell>
                          {r.pix_proof_url ? (
                            <Button variant="link" size="sm" className="p-0 h-auto" onClick={async () => {
                              const { data } = await supabase.storage.from("pix-proofs").createSignedUrl(r.pix_proof_url!, 60);
                              if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                            }}>
                              Ver comprovante →
                            </Button>
                          ) : <span className="text-muted-foreground text-sm">Sem comprovante</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === "pending" && (
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" title="Aprovar e creditar" onClick={() => approveRecharge(r)}>
                                <Check className="h-4 w-4 text-accent" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Rejeitar" onClick={() => rejectRecharge(r)}>
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* ====== USERS TAB ====== */}
        {tab === "users" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gerenciar Usuários</CardTitle>
                <CardDescription>Crie, altere roles, adicione saldo ou remova usuários do sistema</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={fetchUsers} disabled={usersLoading}>
                  <RefreshCw className={`mr-1 h-4 w-4 ${usersLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button size="sm" onClick={() => {
                  setNewUserEmail(""); setNewUserPassword(""); setNewUserName(""); setNewUserRole("customer");
                  setUserDialogOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Novo Usuário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell>
                          <Select
                            value={u.roles[0] || "customer"}
                            onValueChange={async (newRole) => {
                              const { error } = await supabase.functions.invoke("manage-users", {
                                body: { action: "update_role", user_id: u.id, role: newRole },
                              });
                              if (error) { toast.error("Erro ao alterar role"); return; }
                              toast.success("Role atualizada!");
                              fetchUsers();
                            }}
                          >
                            <SelectTrigger className="w-[130px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="collaborator">Colaborador</SelectItem>
                              <SelectItem value="customer">Cliente</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="font-semibold">{formatPrice(u.balance_cents)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Adicionar saldo"
                              onClick={() => {
                                setBalanceUser(u);
                                setBalanceAmount("");
                                setBalanceDialogOpen(true);
                              }}
                            >
                              <BanknoteIcon className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Remover usuário"
                              onClick={async () => {
                                if (!confirm(`Tem certeza que deseja remover ${u.email}?`)) return;
                                const { error } = await supabase.functions.invoke("manage-users", {
                                  body: { action: "delete", user_id: u.id },
                                });
                                if (error) { toast.error("Erro ao remover usuário"); return; }
                                toast.success("Usuário removido!");
                                fetchUsers();
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
      </main>

      {/* Service Dialog */}
      <Dialog open={svcDialogOpen} onOpenChange={setSvcDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSvc ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do serviço *</Label>
              <Input value={svcName} onChange={(e) => setSvcName(e.target.value)} placeholder="Ex: Verificação WhatsApp" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} placeholder="Descrição breve do serviço" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={svcType} onValueChange={setSvcType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="verification">Verificação avulsa (código SMS)</SelectItem>
                  <SelectItem value="rental">Aluguel de número</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preço (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)} placeholder="5.00" />
            </div>
            {svcType === "rental" && (
              <div className="space-y-2">
                <Label>Duração (minutos)</Label>
                <Input type="number" min="1" value={svcDuration} onChange={(e) => setSvcDuration(e.target.value)} placeholder="60" />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSvcDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveService} className="flex-1">
                {editingSvc ? "Salvar Alterações" : "Criar Serviço"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Approval Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Chip ao Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{selectedOrder?.service?.name}</p>
              <p className="text-muted-foreground">{selectedOrder && formatPrice(selectedOrder.amount_cents)}</p>
            </div>

            <div className="space-y-2">
              <Label>Selecionar chip disponível</Label>
              <Select value={orderChipId} onValueChange={(v) => {
                setOrderChipId(v);
                const chip = chips.find((c) => c.id === v);
                if (chip) setOrderPhone(chip.phone_number);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um chip" />
                </SelectTrigger>
                <SelectContent>
                  {chips.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Nenhum chip ativo disponível
                    </SelectItem>
                  )}
                  {chips.map((chip) => (
                    <SelectItem key={chip.id} value={chip.id}>
                      {chip.phone_number} {chip.operator ? `· ${chip.operator}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {chips.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Nenhum chip ativo. Aguarde os colaboradores conectarem chipeiras.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Número exibido ao cliente</Label>
              <Input value={orderPhone} onChange={(e) => setOrderPhone(e.target.value)} placeholder="+5511999999999" />
            </div>

            <div className="space-y-2">
              <Label>Notas internas (opcional)</Label>
              <Textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Observações" rows={2} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOrderDialogOpen(false)}>Cancelar</Button>
              <Button onClick={approveOrder} className="flex-1">
                <Check className="mr-2 h-4 w-4" /> Ativar Pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha *</Label>
              <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="collaborator">Colaborador</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setUserDialogOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!newUserEmail || !newUserPassword || newUserPassword.length < 6) {
                    toast.error("Preencha email e senha (min 6 caracteres)");
                    return;
                  }
                  const { data, error } = await supabase.functions.invoke("manage-users", {
                    body: {
                      action: "create",
                      email: newUserEmail,
                      password: newUserPassword,
                      full_name: newUserName,
                      role: newUserRole,
                    },
                  });
                  if (error || data?.error) {
                    toast.error(data?.error || "Erro ao criar usuário");
                    return;
                  }
                  toast.success("Usuário criado com sucesso!");
                  setUserDialogOpen(false);
                  fetchUsers();
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Criar Usuário
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Balance Dialog */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Saldo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{balanceUser?.full_name || balanceUser?.email}</p>
              <p className="text-muted-foreground">Saldo atual: {balanceUser ? formatPrice(balanceUser.balance_cents) : "—"}</p>
            </div>
            <div className="space-y-2">
              <Label>Valor a adicionar (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="10.00"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setBalanceDialogOpen(false)}>Cancelar</Button>
              <Button onClick={addBalance} className="flex-1">
                <BanknoteIcon className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
