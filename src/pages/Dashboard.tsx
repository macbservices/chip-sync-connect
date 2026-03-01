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
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";
import {
  LogOut,
  MapPin,
  Plus,
  Smartphone,
  Signal,
  Wifi,
  WifiOff,
  Copy,
  Trash2,
  RefreshCw,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
} from "lucide-react";

type Location = {
  id: string;
  name: string;
  description: string | null;
  api_key: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  user_id: string;
};

type Modem = {
  id: string;
  location_id: string;
  port_name: string;
  imei: string | null;
  operator: string | null;
  signal_strength: number | null;
  status: string;
  last_seen_at: string | null;
};

type Chip = {
  id: string;
  modem_id: string;
  phone_number: string;
  iccid: string | null;
  operator: string | null;
  status: string;
  detected_at: string;
};

type WeeklySale = {
  service_name: string;
  service_type: string;
  total_orders: number;
  total_revenue_cents: number;
  commission_cents: number;
  week_start: string;
  location_name: string;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const [locations, setLocations] = useState<Location[]>([]);
  const [modems, setModems] = useState<Modem[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationDesc, setNewLocationDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"chipeiras" | "relatorio" | "saldo">("chipeiras");
  const [weeklySales, setWeeklySales] = useState<WeeklySale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  // Commission balance
  const [commissionBalance, setCommissionBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [ownerMap, setOwnerMap] = useState<Record<string, { name: string; email: string }>>({}); 

  useEffect(() => {
    checkAuth();
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetchModems(selectedLocation);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (tab === "relatorio") {
      fetchWeeklySales();
    }
    if (tab === "saldo") {
      fetchCommissionBalance();
    }
  }, [tab]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("modems-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "modems" }, () => {
        if (selectedLocation) fetchModems(selectedLocation);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chips" }, () => {
        if (selectedLocation) fetchModems(selectedLocation);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, () => {
        fetchLocations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedLocation]);

  // Poll every 30s to detect stale modems
  useEffect(() => {
    if (!selectedLocation) return;
    const interval = setInterval(() => {
      fetchModems(selectedLocation);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedLocation]);

  const checkAuth = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) navigate("/auth");
  };

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { toast.error("Erro ao carregar localizações"); return; }
    setLocations(data || []);
    if (data && data.length > 0 && !selectedLocation) {
      setSelectedLocation(data[0].id);
    }

    // If admin, fetch owner info for each location
    if (isAdmin && data && data.length > 0) {
      const uniqueUserIds = [...new Set(data.map(l => l.user_id))];
      const { data: usersData } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });
      if (usersData) {
        const map: Record<string, { name: string; email: string }> = {};
        for (const uid of uniqueUserIds) {
          const u = (usersData as any[]).find((u: any) => u.id === uid);
          if (u) map[uid] = { name: u.full_name || "—", email: u.email || "—" };
        }
        setOwnerMap(map);
      }
    }

    setLoading(false);
  };

  const fetchModems = async (locationId: string) => {
    const { data: modemData } = await supabase
      .from("modems")
      .select("*")
      .eq("location_id", locationId)
      .order("port_name");

    setModems(modemData || []);

    if (modemData && modemData.length > 0) {
      const modemIds = modemData.map((m) => m.id);
      const { data: chipData } = await supabase
        .from("chips")
        .select("*")
        .in("modem_id", modemIds)
        .order("detected_at", { ascending: false });
      setChips(chipData || []);
    } else {
      setChips([]);
    }
  };

  const fetchWeeklySales = async () => {
    setSalesLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get collaborator's own orders via their chips
    // We query orders linked to chips from the collaborator's locations
    const { data: locData } = await supabase
      .from("locations")
      .select("id, name")
      .eq("user_id", user.id);

    if (!locData || locData.length === 0) {
      setWeeklySales([]);
      setSalesLoading(false);
      return;
    }

    const locIds = locData.map((l) => l.id);

    // Get modems for these locations
    const { data: modemData } = await supabase
      .from("modems")
      .select("id, location_id")
      .in("location_id", locIds);

    if (!modemData || modemData.length === 0) {
      setWeeklySales([]);
      setSalesLoading(false);
      return;
    }

    const modemIds = modemData.map((m) => m.id);

    // Get chips
    const { data: chipData } = await supabase
      .from("chips")
      .select("id, modem_id")
      .in("modem_id", modemIds);

    if (!chipData || chipData.length === 0) {
      setWeeklySales([]);
      setSalesLoading(false);
      return;
    }

    const chipIds = chipData.map((c) => c.id);

    // Get orders through these chips in last 4 weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, chip_id, service_id, amount_cents, status, created_at, service:services(name, type)")
      .in("chip_id", chipIds)
      .in("status", ["active", "completed"])
      .gte("created_at", fourWeeksAgo.toISOString());

    if (!ordersData || ordersData.length === 0) {
      setWeeklySales([]);
      setSalesLoading(false);
      return;
    }

    // Group by week + service
    const groupMap = new Map<string, WeeklySale>();
    for (const order of ordersData as any[]) {
      const weekStart = getWeekStart(new Date(order.created_at));
      const loc = locData.find((l) => {
        const m = modemData.find((m) => {
          const c = chipData.find((c) => c.id === order.chip_id);
          return c && m.id === c.modem_id;
        });
        return m && m.location_id === l.id;
      });
      const key = `${weekStart}-${order.service_id}`;
      if (groupMap.has(key)) {
        const entry = groupMap.get(key)!;
        entry.total_orders += 1;
        entry.total_revenue_cents += order.amount_cents;
        entry.commission_cents = Math.round(entry.total_revenue_cents * 0.4);
      } else {
        groupMap.set(key, {
          service_name: order.service?.name || "—",
          service_type: order.service?.type || "—",
          total_orders: 1,
          total_revenue_cents: order.amount_cents,
          commission_cents: Math.round(order.amount_cents * 0.4),
          week_start: weekStart,
          location_name: loc?.name || "—",
        });
      }
    }

    setWeeklySales(Array.from(groupMap.values()).sort((a, b) => b.week_start.localeCompare(a.week_start)));
    setSalesLoading(false);
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  };

  const fetchCommissionBalance = async () => {
    setWithdrawLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setWithdrawLoading(false); return; }

    // Calculate total earned commissions from orders through collaborator's chips
    const { data: locData } = await supabase.from("locations").select("id").eq("user_id", user.id);
    if (!locData || locData.length === 0) { setCommissionBalance(0); setWithdrawLoading(false); return; }

    const { data: modemData } = await supabase.from("modems").select("id").in("location_id", locData.map(l => l.id));
    if (!modemData || modemData.length === 0) { setCommissionBalance(0); setWithdrawLoading(false); return; }

    const { data: chipData } = await supabase.from("chips").select("id").in("modem_id", modemData.map(m => m.id));
    if (!chipData || chipData.length === 0) { setCommissionBalance(0); setWithdrawLoading(false); return; }

    const { data: ordersData } = await supabase
      .from("orders")
      .select("amount_cents")
      .in("chip_id", chipData.map(c => c.id))
      .in("status", ["active", "completed"]);

    const totalCommission = Math.round((ordersData || []).reduce((acc, o) => acc + o.amount_cents, 0) * 0.4);

    // Subtract already paid/approved withdrawals
    const { data: wData } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setWithdrawals(wData || []);

    const totalWithdrawn = (wData || [])
      .filter((w: any) => ["approved", "paid"].includes(w.status))
      .reduce((acc: number, w: any) => acc + w.amount_cents, 0);

    setCommissionBalance(Math.max(0, totalCommission - totalWithdrawn));
    setWithdrawLoading(false);
  };

  const requestWithdrawal = async () => {
    const cents = Math.round(parseFloat(withdrawAmount) * 100);
    if (isNaN(cents) || cents <= 0) { toast.error("Informe um valor válido"); return; }
    if (cents > commissionBalance) { toast.error("Saldo insuficiente"); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user.id,
      amount_cents: cents,
    });

    if (error) { toast.error("Erro ao solicitar saque"); return; }
    toast.success("Solicitação de saque enviada!");
    setWithdrawAmount("");
    fetchCommissionBalance();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const createLocation = async () => {
    if (!newLocationName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("locations").insert({
      name: newLocationName,
      description: newLocationDesc || null,
      user_id: user.id,
    });

    if (error) { toast.error("Erro ao criar localização"); return; }
    toast.success("Localização criada!");
    setNewLocationName("");
    setNewLocationDesc("");
    setDialogOpen(false);
    fetchLocations();
  };

  const deleteLocation = async (id: string) => {
    if (!confirm("Tem certeza? Todos os modems e chips desta localização serão excluídos.")) return;
    const { error } = await supabase.rpc("delete_location_cascade", { _location_id: id });
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Localização excluída");
    if (selectedLocation === id) setSelectedLocation(null);
    fetchLocations();
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API Key copiada!");
  };

  // Determine effective modem status based on last_seen_at (stale after 2 min)
  const getEffectiveStatus = (modem: Modem) => {
    if (modem.status === "online" && modem.last_seen_at) {
      const lastSeen = new Date(modem.last_seen_at).getTime();
      const now = Date.now();
      if (now - lastSeen > 2 * 60 * 1000) return "offline";
    }
    return modem.status;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online": return <Badge className="bg-accent text-accent-foreground">Online</Badge>;
      case "offline": return <Badge variant="secondary">Offline</Badge>;
      case "error": return <Badge variant="destructive">Erro</Badge>;
      case "active": return <Badge className="bg-accent text-accent-foreground">Ativo</Badge>;
      case "exhausted": return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Esgotado
        </Badge>
      );
      case "inactive": return <Badge variant="secondary">Inativo</Badge>;
      case "blocked": return <Badge variant="destructive">Bloqueado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const selectedLoc = locations.find((l) => l.id === selectedLocation);
  const totalOnline = modems.filter((m) => getEffectiveStatus(m) === "online").length;
  const totalChips = chips.filter((c) => c.status === "active").length;
  const exhaustedChips = chips.filter((c) => c.status === "exhausted").length;

  // Weekly summary for report
  const totalRevenue = weeklySales.reduce((acc, s) => acc + s.total_revenue_cents, 0);
  const totalCommission = weeklySales.reduce((acc, s) => acc + s.commission_cents, 0);
  const totalOrders = weeklySales.reduce((acc, s) => acc + s.total_orders, 0);

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">CHIP SMS</h1>
            <span className="hidden sm:inline text-muted-foreground text-sm">— Painel do Colaborador</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={tab === "chipeiras" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("chipeiras")}
            >
              <Wifi className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Chipeiras</span>
            </Button>
            <Button
              variant={tab === "relatorio" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("relatorio")}
            >
              <BarChart3 className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Relatório</span>
            </Button>
            <Button
              variant={tab === "saldo" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("saldo")}
            >
              <Wallet className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Saldo</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">

        {/* ===== CHIPEIRAS TAB ===== */}
        {tab === "chipeiras" && (
          <>
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Localizações</p>
                    <p className="text-2xl font-bold">{locations.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                    <Wifi className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Modems Online</p>
                    <p className="text-2xl font-bold">{totalOnline}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={exhaustedChips > 0 ? "border-destructive/50" : ""}>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${exhaustedChips > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                    <Signal className={`h-6 w-6 ${exhaustedChips > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Chips Ativos</p>
                    <p className="text-2xl font-bold">{totalChips}</p>
                    {exhaustedChips > 0 && (
                      <p className="text-xs text-destructive font-semibold flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        {exhaustedChips} esgotado(s)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Exhaustion alert banner */}
            {exhaustedChips > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">
                    {exhaustedChips} chip(s) esgotado(s) precisam de substituição
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Os chips marcados como esgotados atingiram o limite de ativações. Substitua-os na chipeira para restaurar o serviço.
                  </p>
                </div>
              </div>
            )}

            {/* Locations */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Localizações</CardTitle>
                  <CardDescription>Locais onde o app .exe está instalado</CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Localização
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Localização</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} placeholder="Ex: Escritório SP" />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição (opcional)</Label>
                        <Input value={newLocationDesc} onChange={(e) => setNewLocationDesc(e.target.value)} placeholder="Detalhes do local" />
                      </div>
                      <Button onClick={createLocation} className="w-full">Criar Localização</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {locations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma localização cadastrada. Crie uma para começar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {locations.map((loc) => (
                      <div
                        key={loc.id}
                        onClick={() => setSelectedLocation(loc.id)}
                        className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                          selectedLocation === loc.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-2.5 w-2.5 rounded-full ${
                            loc.last_seen_at && Date.now() - new Date(loc.last_seen_at).getTime() < 300000
                              ? "bg-accent animate-pulse"
                              : "bg-muted-foreground"
                          }`} />
                          <div>
                            <p className="font-medium">{loc.name}</p>
                            {loc.description && <p className="text-sm text-muted-foreground">{loc.description}</p>}
                            {isAdmin && ownerMap[loc.user_id] && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                👤 {ownerMap[loc.user_id].name} — {ownerMap[loc.user_id].email}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => copyApiKey(loc.api_key)} title="Copiar API Key">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteLocation(loc.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedLoc && (
              <>
                {/* API Key */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">API Key — {selectedLoc.name}</CardTitle>
                    <CardDescription>Use esta chave no app .exe para autenticar nesta localização</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                        {selectedLoc.api_key}
                      </code>
                      <Button variant="outline" size="icon" onClick={() => copyApiKey(selectedLoc.api_key)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Modems */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Modems</CardTitle>
                    <CardDescription>Chipeiras GSM detectadas nesta localização</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {modems.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                        <WifiOff className="h-10 w-10" />
                        <p>Nenhum modem conectado</p>
                        <p className="text-sm">Inicie o app .exe neste local para ver os modems aqui</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Porta</TableHead>
                            <TableHead>IMEI</TableHead>
                            <TableHead>Operadora</TableHead>
                            <TableHead>Sinal</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Última vez</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {modems.map((modem) => (
                            <TableRow key={modem.id}>
                              <TableCell className="font-mono">{modem.port_name}</TableCell>
                              <TableCell className="font-mono text-sm">{modem.imei || "—"}</TableCell>
                              <TableCell>{modem.operator || "—"}</TableCell>
                              <TableCell>{modem.signal_strength != null ? `${modem.signal_strength}%` : "—"}</TableCell>
                              <TableCell>{getStatusBadge(getEffectiveStatus(modem))}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {modem.last_seen_at ? new Date(modem.last_seen_at).toLocaleString("pt-BR") : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Chips with exhaustion indicator */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Chips / Números</CardTitle>
                    <CardDescription>Números identificados nos modems desta localização</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const onlineModemIds = modems.filter(m => getEffectiveStatus(m) === "online").map(m => m.id);
                      const activeChips = chips.filter(c => onlineModemIds.includes(c.modem_id));
                      return activeChips.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                        <Smartphone className="h-10 w-10" />
                        <p>{chips.length > 0 ? "Modems offline — chips não disponíveis" : "Nenhum chip detectado"}</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>ICCID</TableHead>
                            <TableHead>Operadora</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Detectado em</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeChips.map((chip) => (
                            <TableRow
                              key={chip.id}
                              className={chip.status === "exhausted" ? "bg-destructive/5" : ""}
                            >
                              <TableCell className="font-mono font-medium">
                                {chip.phone_number}
                                {chip.status === "exhausted" && (
                                  <span className="ml-2 text-xs text-destructive font-semibold">
                                    ⚠ ESGOTADO — Substituir
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{chip.iccid || "—"}</TableCell>
                              <TableCell>{chip.operator || "—"}</TableCell>
                              <TableCell>{getStatusBadge(chip.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(chip.detected_at).toLocaleString("pt-BR")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                    })()}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* ===== RELATÓRIO TAB ===== */}
        {tab === "relatorio" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Relatório de Vendas</h2>
                <p className="text-muted-foreground text-sm mt-1">Últimas 4 semanas — comissão de 40% sobre vendas</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchWeeklySales} disabled={salesLoading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${salesLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total vendido</p>
                      <p className="text-xl font-bold text-primary">{formatPrice(totalRevenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-accent/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sua comissão (40%)</p>
                      <p className="text-xl font-bold text-accent">{formatPrice(totalCommission)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                      <Signal className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de pedidos</p>
                      <p className="text-xl font-bold">{totalOrders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Weekly breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Semana</CardTitle>
                <CardDescription>Pedidos completados ou ativos via seus chips</CardDescription>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <div className="flex justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : weeklySales.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-30" />
                    <p>Nenhuma venda encontrada nas últimas 4 semanas.</p>
                    <p className="text-sm mt-1">As vendas aparecerão aqui quando clientes comprarem via seus chips.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Semana</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Receita total</TableHead>
                        <TableHead className="text-right text-accent">Sua comissão (40%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weeklySales.map((sale, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">
                            Semana de {new Date(sale.week_start + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </TableCell>
                          <TableCell>{sale.service_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{sale.location_name}</TableCell>
                          <TableCell className="text-right font-semibold">{sale.total_orders}</TableCell>
                          <TableCell className="text-right font-semibold">{formatPrice(sale.total_revenue_cents)}</TableCell>
                          <TableCell className="text-right font-bold text-accent">{formatPrice(sale.commission_cents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ===== SALDO TAB ===== */}
        {tab === "saldo" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Saldo de Comissões</h2>
                <p className="text-muted-foreground text-sm mt-1">40% sobre vendas realizadas via seus chips</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchCommissionBalance} disabled={withdrawLoading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${withdrawLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            <Card className="border-primary/20">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saldo disponível</p>
                      <p className="text-3xl font-bold text-primary">{formatPrice(commissionBalance)}</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:w-40 space-y-1">
                      <Label className="text-xs">Valor do saque (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    <Button onClick={requestWithdrawal} disabled={commissionBalance <= 0}>
                      <ArrowUpRight className="mr-1.5 h-4 w-4" />
                      Solicitar Saque
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Saques</CardTitle>
                <CardDescription>Suas solicitações de saque e status</CardDescription>
              </CardHeader>
              <CardContent>
                {withdrawLoading ? (
                  <div className="flex justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : withdrawals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wallet className="mx-auto h-10 w-10 mb-3 opacity-30" />
                    <p>Nenhum saque solicitado.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Comprovante</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((w: any) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-bold">{formatPrice(w.amount_cents)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              w.status === "paid" ? "default" :
                              w.status === "approved" ? "default" :
                              w.status === "rejected" ? "destructive" : "outline"
                            }>
                              {w.status === "pending" ? "Pendente" :
                               w.status === "approved" ? "Aprovado" :
                               w.status === "paid" ? "Pago" : "Rejeitado"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {w.payment_proof_url ? (
                              <Button variant="link" size="sm" className="p-0 h-auto" onClick={async () => {
                                const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(w.payment_proof_url, 60);
                                if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                              }}>
                                Ver comprovante →
                              </Button>
                            ) : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(w.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
