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
  Plus, Check, X, Package, DollarSign,
  Wallet, Pencil, Trash2, RefreshCw, LogOut, AlertTriangle, Users, BanknoteIcon, RotateCcw, KeyRound, BarChart3, TrendingUp, ArrowDownToLine, Upload, Smartphone, Link2, Copy
} from "lucide-react";
import macChipLogo from "@/assets/mac-chip-logo.png";
import NotificationBell from "@/components/NotificationBell";
import { DarkModeToggle } from "@/components/DarkModeToggle";

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
  fraud_alert: string | null;
  created_at: string;
  service: { name: string; type: string } | null;
  customer_name?: string;
  customer_email?: string;
};

type RechargeRequest = {
  id: string;
  user_id: string;
  amount_cents: number;
  status: string;
  pix_proof_url: string | null;
  admin_notes: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
};

type Chip = {
  id: string;
  phone_number: string;
  operator: string | null;
  status: string;
};

type ChipStats = {
  totalActive: number;
  totalExhausted: number;
  totalOnline: number;
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
  const [tab, setTab] = useState<"orders" | "services" | "recharges" | "users" | "report" | "withdrawals" | "affiliates">("orders");
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [loading, setLoading] = useState(true);
  const [chipStats, setChipStats] = useState<ChipStats>({ totalActive: 0, totalExhausted: 0, totalOnline: 0 });

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

  // Deduct balance dialog
  const [deductDialogOpen, setDeductDialogOpen] = useState(false);
  const [deductUser, setDeductUser] = useState<UserEntry | null>(null);
  const [deductAmount, setDeductAmount] = useState("");

  // Reset password dialog
  const [resetPwDialogOpen, setResetPwDialogOpen] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<UserEntry | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");

  // Sales report
  type SalesReportEntry = {
    collaborator_id: string;
    collaborator_name: string;
    collaborator_email: string;
    location_name: string;
    service_name: string;
    service_type: string;
    total_orders: number;
    total_revenue_cents: number;
    commission_cents: number;
  };
  const [salesReport, setSalesReport] = useState<SalesReportEntry[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Withdrawals
  type WithdrawalEntry = {
    id: string;
    user_id: string;
    amount_cents: number;
    status: string;
    payment_proof_url: string | null;
    admin_notes: string | null;
    created_at: string;
    user_name?: string;
    user_email?: string;
  };
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalEntry[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [confirmPayDialogOpen, setConfirmPayDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalEntry | null>(null);

  // Affiliates
  type AffiliateEntry = {
    id: string;
    user_id: string;
    referral_code: string;
    is_active: boolean;
    balance_cents: number;
    created_at: string;
    user_name?: string;
    user_email?: string;
    referred_count?: number;
    total_earned?: number;
  };
  const [affiliates, setAffiliates] = useState<AffiliateEntry[]>([]);
  const [affiliatesLoading, setAffiliatesLoading] = useState(false);
  const [newAffiliateEmail, setNewAffiliateEmail] = useState("");
  const [newAffiliateName, setNewAffiliateName] = useState("");
  const [newAffiliatePassword, setNewAffiliatePassword] = useState("");
  const [affiliateDialogOpen, setAffiliateDialogOpen] = useState(false);
  const [affiliateMode, setAffiliateMode] = useState<"existing" | "new">("existing");
  const [selectedUserForAffiliate, setSelectedUserForAffiliate] = useState("");
  const [affBalanceDialogOpen, setAffBalanceDialogOpen] = useState(false);
  const [affDeductDialogOpen, setAffDeductDialogOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateEntry | null>(null);
  const [affBalanceAmount, setAffBalanceAmount] = useState("");
  const [affEditDialogOpen, setAffEditDialogOpen] = useState(false);
  const [affEditBalance, setAffEditBalance] = useState("");

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

    const [{ data: svcData }, { data: ordData }, { data: rechData }, { data: chipData }, { data: allChipsData }, { data: onlineChipsData }] = await Promise.all([
      supabase.from("services").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*, service:services(name, type)").order("created_at", { ascending: false }) as any,
      supabase.from("recharge_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("chips").select("id, phone_number, operator, status").in("status", ["active"]),
      supabase.from("chips").select("id, status, modem_id, modems!inner(id, location_id, locations:locations!inner(id, is_active))") as any,
      supabase.from("chips").select("id, status, modem_id, modems!inner(id, last_seen_at, location_id, locations:locations!inner(id, is_active))").eq("status", "active") as any,
    ]);

    setServices(svcData || []);
    setChips((chipData as any) || []);

    // Fetch user info to enrich orders and recharges
    const ordList = (ordData as any) || [];
    const rechList = (rechData as any) || [];
    let userMap = new Map<string, any>();

    if (ordList.length > 0 || rechList.length > 0) {
      const { data: usersData } = await supabase.functions.invoke("manage-users", { body: { action: "list" } });
      userMap = new Map((usersData || []).map((u: any) => [u.id, u]));
    }

    // Enrich orders with customer info
    const enrichedOrders = ordList.map((o: any) => {
      const u = userMap.get(o.customer_id) as any;
      return { ...o, customer_name: u?.full_name || "—", customer_email: u?.email || "—" };
    });
    setOrders(enrichedOrders);

    // Enrich recharges with user info
    const enrichedRecharges = rechList.map((r: any) => {
      const u = userMap.get(r.user_id) as any;
      return { ...r, user_name: u?.full_name || "—", user_email: u?.email || "—" };
    });
    setRecharges(enrichedRecharges);

    // Chip stats — only count chips linked to active locations
    const allChips = (allChipsData || []).filter((c: any) => c.modems?.locations);
    const activeChips = allChips.filter((c: any) => c.status === "active").length;
    const exhaustedChips = allChips.filter((c: any) => c.status === "exhausted").length;
    // Online chips: active chips on modems seen in last 5 min
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const onlineChips = (onlineChipsData || []).filter((c: any) => c.modems?.locations && c.modems?.last_seen_at && c.modems.last_seen_at > fiveMinAgo).length;
    setChipStats({ totalActive: activeChips, totalExhausted: exhaustedChips, totalOnline: onlineChips });

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
    if (tab === "users" && users.length === 0) { fetchUsers(); fetchAffiliates(); }
    if (tab === "report" && salesReport.length === 0) fetchSalesReport();
    if (tab === "withdrawals") fetchWithdrawals();
    if (tab === "affiliates") fetchAffiliates();
  }, [tab]);

  const fetchAffiliates = async () => {
    setAffiliatesLoading(true);
    const { data: affData } = await supabase.from("affiliates").select("*").order("created_at", { ascending: false });
    const affList = (affData as any) || [];

    if (affList.length > 0) {
      const { data: usersData } = await supabase.functions.invoke("manage-users", { body: { action: "list" } });
      const uMap = new Map((usersData || []).map((u: any) => [u.id, u]));

      // Get referred counts
      const { data: profilesData } = await supabase.from("profiles").select("referred_by_affiliate_id");
      const refCounts = new Map<string, number>();
      (profilesData || []).forEach((p: any) => {
        if (p.referred_by_affiliate_id) {
          refCounts.set(p.referred_by_affiliate_id, (refCounts.get(p.referred_by_affiliate_id) || 0) + 1);
        }
      });

      // Get total earned per affiliate
      const { data: commsData } = await supabase.from("affiliate_commissions").select("affiliate_id, amount_cents");
      const earnedMap = new Map<string, number>();
      (commsData as any[] || []).forEach((c: any) => {
        earnedMap.set(c.affiliate_id, (earnedMap.get(c.affiliate_id) || 0) + c.amount_cents);
      });

      const enriched = affList.map((a: any) => {
        const u = uMap.get(a.user_id) as any;
        return {
          ...a,
          user_name: u?.full_name || "—",
          user_email: u?.email || "—",
          referred_count: refCounts.get(a.id) || 0,
          total_earned: earnedMap.get(a.id) || 0,
        };
      });
      setAffiliates(enriched);
    } else {
      setAffiliates([]);
    }
    setAffiliatesLoading(false);
  };

  const createAffiliate = async () => {
    if (affiliateMode === "existing") {
      if (!selectedUserForAffiliate) { toast.error("Selecione um usuário"); return; }
      const { data: existingAff } = await supabase.from("affiliates").select("id").eq("user_id", selectedUserForAffiliate).maybeSingle();
      if (existingAff) { toast.error("Este usuário já é um afiliado"); return; }
      const { error } = await supabase.from("affiliates").insert({ user_id: selectedUserForAffiliate });
      if (error) { toast.error(error.message); return; }
    } else {
      if (!newAffiliateEmail.trim()) { toast.error("Informe o e-mail"); return; }
      if (!newAffiliatePassword || newAffiliatePassword.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }

      const { data: createData, error: createError } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create",
          email: newAffiliateEmail.trim(),
          password: newAffiliatePassword,
          full_name: newAffiliateName.trim(),
          role: "customer",
        },
      });
      if (createError || createData?.error) {
        toast.error(createData?.error || "Erro ao criar conta do afiliado");
        return;
      }
      const { error } = await supabase.from("affiliates").insert({ user_id: createData.id });
      if (error) { toast.error(error.message); return; }
    }

    toast.success("Afiliado cadastrado com sucesso!");
    setAffiliateDialogOpen(false);
    setNewAffiliateEmail("");
    setNewAffiliateName("");
    setNewAffiliatePassword("");
    setSelectedUserForAffiliate("");
    fetchAffiliates();
  };

  const toggleAffiliate = async (id: string, isActive: boolean) => {
    await supabase.from("affiliates").update({ is_active: !isActive }).eq("id", id);
    toast.success(isActive ? "Afiliado desativado" : "Afiliado ativado");
    fetchAffiliates();
  };

  const removeAffiliate = async (id: string) => {
    await supabase.from("affiliates").delete().eq("id", id);
    toast.success("Afiliado removido");
    fetchAffiliates();
  };

  const addAffiliateBalance = async () => {
    if (!selectedAffiliate) return;
    const amount = Math.round(parseFloat(affBalanceAmount) * 100);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido"); return; }
    await supabase.from("affiliates").update({ balance_cents: selectedAffiliate.balance_cents + amount }).eq("id", selectedAffiliate.id);
    toast.success("Saldo adicionado!");
    setAffBalanceDialogOpen(false);
    setAffBalanceAmount("");
    fetchAffiliates();
  };

  const deductAffiliateBalance = async () => {
    if (!selectedAffiliate) return;
    const amount = Math.round(parseFloat(affBalanceAmount) * 100);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido"); return; }
    if (amount > selectedAffiliate.balance_cents) { toast.error("Saldo insuficiente"); return; }
    await supabase.from("affiliates").update({ balance_cents: selectedAffiliate.balance_cents - amount }).eq("id", selectedAffiliate.id);
    toast.success("Saldo deduzido!");
    setAffDeductDialogOpen(false);
    setAffBalanceAmount("");
    fetchAffiliates();
  };

  const editAffiliateBalance = async () => {
    if (!selectedAffiliate) return;
    const amount = Math.round(parseFloat(affEditBalance) * 100);
    if (isNaN(amount) || amount < 0) { toast.error("Valor inválido"); return; }
    await supabase.from("affiliates").update({ balance_cents: amount }).eq("id", selectedAffiliate.id);
    toast.success("Saldo atualizado!");
    setAffEditDialogOpen(false);
    setAffEditBalance("");
    fetchAffiliates();
  };

  const fetchWithdrawals = async () => {
    setWithdrawalsLoading(true);
    // Get all withdrawal requests (admin can see all via RLS)
    const { data: wData, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { toast.error("Erro ao carregar saques"); setWithdrawalsLoading(false); return; }

    // Get user info for each withdrawal
    const { data: usersData } = await supabase.functions.invoke("manage-users", { body: { action: "list" } });
    const userMap = new Map((usersData || []).map((u: any) => [u.id, u]));

    const enriched = (wData || []).map((w: any) => {
      const u = userMap.get(w.user_id) as any;
      return { ...w, user_name: u?.full_name || "—", user_email: u?.email || "—" };
    });

    setWithdrawalRequests(enriched);
    setWithdrawalsLoading(false);
  };

  const approveWithdrawal = async (w: WithdrawalEntry) => {
    const { error } = await supabase.from("withdrawal_requests").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", w.id);
    if (error) { toast.error("Erro ao aprovar saque"); return; }
    toast.success("Saque aprovado!");
    fetchWithdrawals();
  };

  const rejectWithdrawal = async (w: WithdrawalEntry) => {
    const { error } = await supabase.from("withdrawal_requests").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", w.id);
    if (error) { toast.error("Erro ao rejeitar saque"); return; }
    toast.success("Saque rejeitado!");
    fetchWithdrawals();
  };

  const confirmPayment = async (withProof: boolean) => {
    if (!selectedWithdrawal) return;

    let filePath: string | null = null;

    if (withProof) {
      if (!paymentProofFile) { toast.error("Anexe o comprovante"); return; }
      filePath = `${selectedWithdrawal.id}/${Date.now()}-${paymentProofFile.name}`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(filePath, paymentProofFile);
      if (uploadError) { toast.error("Erro ao enviar comprovante"); return; }
    }

    const updateData: any = { status: "paid", updated_at: new Date().toISOString() };
    if (filePath) updateData.payment_proof_url = filePath;

    const { error } = await supabase.from("withdrawal_requests").update(updateData).eq("id", selectedWithdrawal.id);
    if (error) { toast.error("Erro ao confirmar pagamento"); return; }
    toast.success("Pagamento confirmado!");
    setConfirmPayDialogOpen(false);
    setPaymentProofFile(null);
    setSelectedWithdrawal(null);
    fetchWithdrawals();
  };

  const fetchSalesReport = async () => {
    setReportLoading(true);
    try {
      // Get all collaborators
      const { data: usersData } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });
      const collaborators = (usersData || []).filter((u: any) => u.roles?.includes("collaborator"));

      if (collaborators.length === 0) {
        setSalesReport([]);
        setReportLoading(false);
        return;
      }

      const collabIds = collaborators.map((c: any) => c.id);

      // Get locations for all collaborators
      const { data: locData } = await supabase
        .from("locations")
        .select("id, name, user_id")
        .in("user_id", collabIds);

      if (!locData || locData.length === 0) {
        setSalesReport([]);
        setReportLoading(false);
        return;
      }

      const locIds = locData.map((l) => l.id);

      // Get modems → chips → orders chain
      const { data: modemData } = await supabase.from("modems").select("id, location_id").in("location_id", locIds);
      if (!modemData || modemData.length === 0) { setSalesReport([]); setReportLoading(false); return; }

      const modemIds = modemData.map((m) => m.id);
      const { data: chipData } = await supabase.from("chips").select("id, modem_id").in("modem_id", modemIds);
      if (!chipData || chipData.length === 0) { setSalesReport([]); setReportLoading(false); return; }

      const chipIds = chipData.map((c) => c.id);

      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, chip_id, service_id, amount_cents, status, created_at, service:services(name, type)")
        .in("chip_id", chipIds)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false });

      // Group by collaborator + location + service
      const groupMap = new Map<string, SalesReportEntry>();
      for (const order of (ordersData || []) as any[]) {
        const chip = chipData.find((c) => c.id === order.chip_id);
        const modem = chip ? modemData.find((m) => m.id === chip.modem_id) : null;
        const loc = modem ? locData.find((l) => l.id === modem.location_id) : null;
        const collab = loc ? collaborators.find((c: any) => c.id === loc.user_id) : null;
        if (!collab || !loc) continue;

        const key = `${collab.id}-${loc.id}-${order.service_id}`;
        if (groupMap.has(key)) {
          const entry = groupMap.get(key)!;
          entry.total_orders += 1;
          entry.total_revenue_cents += order.amount_cents;
          entry.commission_cents = Math.round(entry.total_revenue_cents * 0.4);
        } else {
          groupMap.set(key, {
            collaborator_id: collab.id,
            collaborator_name: collab.full_name || collab.email,
            collaborator_email: collab.email,
            location_name: loc.name,
            service_name: order.service?.name || "—",
            service_type: order.service?.type || "—",
            total_orders: 1,
            total_revenue_cents: order.amount_cents,
            commission_cents: Math.round(order.amount_cents * 0.4),
          });
        }
      }

      setSalesReport(Array.from(groupMap.values()).sort((a, b) => b.total_revenue_cents - a.total_revenue_cents));
    } catch (err) {
      toast.error("Erro ao carregar relatório");
    }
    setReportLoading(false);
  };

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

  const resetAllChipActivations = async () => {
    if (!confirm("⚠️ ATENÇÃO: Isso vai zerar TODAS as ativações de serviços em TODOS os chips. Tem certeza?")) return;
    if (!confirm("Última confirmação: essa ação é irreversível. Continuar?")) return;
    const { error } = await supabase.rpc("admin_reset_all_chip_activations");
    if (error) { toast.error("Erro ao zerar ativações: " + error.message); return; }
    toast.success("Todas as ativações de chips foram zeradas!");
  };

  const deleteRecharge = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta recarga?")) return;
    const { error } = await supabase.from("recharge_requests").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir recarga: " + error.message); return; }
    toast.success("Recarga removida!");
    fetchAll();
  };

  const deleteWithdrawal = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este saque?")) return;
    const { error } = await supabase.from("withdrawal_requests").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir saque: " + error.message); return; }
    toast.success("Saque removido!");
    fetchWithdrawals();
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm("Tem certeza que deseja apagar este pedido do histórico?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) { toast.error("Erro ao apagar pedido: " + error.message); return; }
    toast.success("Pedido removido do histórico!");
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

  const deductBalance = async () => {
    if (!deductUser || !deductAmount) return;
    const cents = Math.round(parseFloat(deductAmount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "deduct_balance", user_id: deductUser.id, amount_cents: cents },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao retirar saldo");
      return;
    }
    toast.success(`Saldo retirado! Novo saldo: ${formatPrice(data.new_balance)}`);
    setDeductDialogOpen(false);
    setDeductAmount("");
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
            <img src={macChipLogo} alt="Mac Chip" className="h-9 w-9 rounded-lg object-contain" />
            <span className="text-xl font-bold">MAC CHIP</span>
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
            <Button variant={tab === "report" ? "default" : "ghost"} size="sm" onClick={() => setTab("report")}>
              <BarChart3 className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Relatório</span>
            </Button>
            <Button variant={tab === "withdrawals" ? "default" : "ghost"} size="sm" onClick={() => setTab("withdrawals")} className="relative">
              <ArrowDownToLine className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Saques</span>
              {withdrawalRequests.filter(w => w.status === "pending").length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                  {withdrawalRequests.filter(w => w.status === "pending").length}
                </span>
              )}
            </Button>
            <Button variant={tab === "affiliates" ? "default" : "ghost"} size="sm" onClick={() => setTab("affiliates")}>
              <Link2 className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Afiliados</span>
            </Button>
            <NotificationBell />
            <DarkModeToggle />
            <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-6 space-y-6">

        {/* Chip Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <Smartphone className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{chipStats.totalActive}</p>
              <p className="text-xs text-muted-foreground">Chips Ativos</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{chipStats.totalExhausted}</p>
              <p className="text-xs text-muted-foreground">Chips Esgotados</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{chipStats.totalActive + chipStats.totalExhausted}</p>
              <p className="text-xs text-muted-foreground">Total de Chips</p>
            </div>
          </Card>
        </div>

        {/* ====== SERVICES TAB ====== */}
        {tab === "services" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gerenciar Serviços</CardTitle>
                <CardDescription>Adicione, edite ou remova serviços da loja</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={resetAllChipActivations}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Zerar Ativações
                </Button>
                <Button size="sm" onClick={() => openServiceDialog()}>
                  <Plus className="mr-2 h-4 w-4" /> Novo Serviço
                </Button>
              </div>
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
                      <TableHead>Cliente</TableHead>
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
                      <TableRow key={order.id} className={order.fraud_alert ? "bg-destructive/10" : ""}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{order.customer_name || "—"}</span>
                            <span className="text-xs text-muted-foreground">{order.customer_email || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {order.service?.name || "—"}
                          {order.fraud_alert && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertTriangle className="h-3 w-3 text-destructive" />
                              <span className="text-xs text-destructive font-semibold">{order.fraud_alert}</span>
                            </div>
                          )}
                        </TableCell>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Apagar do histórico"
                              onClick={() => deleteOrder(order.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
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
                      <TableHead>Usuário</TableHead>
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
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{r.user_name || "—"}</span>
                            <span className="text-xs text-muted-foreground">{r.user_email || "—"}</span>
                          </div>
                        </TableCell>
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
                          <div className="flex gap-1 justify-end">
                            {r.status === "pending" && (
                              <>
                                <Button variant="ghost" size="icon" title="Aprovar e creditar" onClick={() => approveRecharge(r)}>
                                  <Check className="h-4 w-4 text-accent" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Rejeitar" onClick={() => rejectRecharge(r)}>
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" title="Excluir recarga" onClick={() => deleteRecharge(r.id)}>
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
                              title="Retirar saldo"
                              onClick={() => {
                                setDeductUser(u);
                                setDeductAmount("");
                                setDeductDialogOpen(true);
                              }}
                            >
                              <ArrowDownToLine className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Resetar senha"
                              onClick={() => {
                                setResetPwUser(u);
                                setResetPwValue("");
                                setResetPwDialogOpen(true);
                              }}
                            >
                              <KeyRound className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {affiliates.some((a) => a.user_id === u.id) ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Remover afiliado"
                                onClick={async () => {
                                  if (!confirm("Deseja remover o status de afiliado deste usuário?")) return;
                                  const aff = affiliates.find((a) => a.user_id === u.id);
                                  if (!aff) return;
                                  const { error } = await supabase.from("affiliates").delete().eq("id", aff.id);
                                  if (error) { toast.error(error.message); return; }
                                  toast.success("Afiliado removido!");
                                  fetchAffiliates();
                                }}
                              >
                                <Link2 className="h-4 w-4 text-primary" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Tornar afiliado"
                                onClick={async () => {
                                  const { error } = await supabase.from("affiliates").insert({ user_id: u.id });
                                  if (error) { toast.error(error.message); return; }
                                  toast.success("Usuário adicionado como afiliado!");
                                  fetchAffiliates();
                                }}
                              >
                                <Link2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
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

        {/* ====== REPORT TAB ====== */}
        {tab === "report" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Relatório de Vendas por Colaborador
                </CardTitle>
                <CardDescription>Visão geral das vendas realizadas através das chipeiras dos colaboradores</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={fetchSalesReport} disabled={reportLoading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${reportLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : salesReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma venda encontrada.</p>
              ) : (
                <>
                  {/* Summary cards */}
                  <div className="grid gap-4 sm:grid-cols-3 mb-6">
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                      <p className="text-2xl font-bold">{salesReport.reduce((a, s) => a + s.total_orders, 0)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground">Receita Total</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatPrice(salesReport.reduce((a, s) => a + s.total_revenue_cents, 0))}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground">Comissões (40%)</p>
                      <p className="text-2xl font-bold">
                        {formatPrice(salesReport.reduce((a, s) => a + s.commission_cents, 0))}
                      </p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReport.map((entry, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{entry.collaborator_name}</p>
                              <p className="text-xs text-muted-foreground">{entry.collaborator_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{entry.location_name}</TableCell>
                          <TableCell className="font-medium">{entry.service_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {entry.service_type === "verification" ? "Verificação" : "Aluguel"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{entry.total_orders}</TableCell>
                          <TableCell className="text-right font-semibold text-primary">{formatPrice(entry.total_revenue_cents)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatPrice(entry.commission_cents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ====== WITHDRAWALS TAB ====== */}
        {tab === "withdrawals" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5" />
                  Solicitações de Saque
                </CardTitle>
                <CardDescription>Gerencie os saques de comissão dos colaboradores</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={fetchWithdrawals} disabled={withdrawalsLoading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${withdrawalsLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {withdrawalsLoading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : withdrawalRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma solicitação de saque.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Comprovante</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawalRequests.map((w) => (
                      <TableRow key={w.id} className={w.status === "pending" ? "bg-warning/5" : ""}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{w.user_name}</p>
                            <p className="text-xs text-muted-foreground">{w.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-primary">{formatPrice(w.amount_cents)}</TableCell>
                        <TableCell>{getStatusBadge(w.status === "paid" ? "approved" : w.status)}</TableCell>
                        <TableCell>
                          {w.payment_proof_url ? (
                            <Button variant="link" size="sm" className="p-0 h-auto" onClick={async () => {
                              const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(w.payment_proof_url!, 60);
                              if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                            }}>
                              Ver comprovante →
                            </Button>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(w.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {w.status === "pending" && (
                              <>
                                <Button variant="ghost" size="icon" title="Aprovar" onClick={() => approveWithdrawal(w)}>
                                  <Check className="h-4 w-4 text-accent" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Rejeitar" onClick={() => rejectWithdrawal(w)}>
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            {w.status === "approved" && (
                              <Button size="sm" variant="outline" onClick={() => {
                                setSelectedWithdrawal(w);
                                setPaymentProofFile(null);
                                setConfirmPayDialogOpen(true);
                              }}>
                                <Upload className="mr-1.5 h-4 w-4" />
                                Confirmar Pagamento
                              </Button>
                            )}
                            {w.status === "paid" && (
                              <Badge variant="default">Pago ✓</Badge>
                            )}
                            <Button variant="ghost" size="icon" title="Excluir saque" onClick={() => deleteWithdrawal(w.id)}>
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

        {/* ====== AFFILIATES TAB ====== */}
        {tab === "affiliates" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gerenciar Afiliados</CardTitle>
                <CardDescription>Cadastre e gerencie afiliados que indicam novos usuários</CardDescription>
              </div>
              <Button size="sm" onClick={() => setAffiliateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Cadastrar Afiliado
              </Button>
            </CardHeader>
            <CardContent>
              {affiliatesLoading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : affiliates.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Link2 className="mx-auto h-10 w-10 mb-3 opacity-30" />
                  <p>Nenhum afiliado cadastrado.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Afiliado</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Indicados</TableHead>
                      <TableHead>Total Ganho</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates.map((aff) => (
                      <TableRow key={aff.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{aff.user_name}</span>
                            <span className="text-xs text-muted-foreground">{aff.user_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{aff.referral_code}</code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/auth?ref=${aff.referral_code}`);
                                toast.success("Link copiado!");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{aff.referred_count || 0}</TableCell>
                        <TableCell className="font-semibold">{formatPrice(aff.total_earned || 0)}</TableCell>
                        <TableCell className="font-semibold text-primary">{formatPrice(aff.balance_cents)}</TableCell>
                        <TableCell>
                          <Badge variant={aff.is_active ? "default" : "secondary"}>
                            {aff.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedAffiliate(aff); setAffBalanceAmount(""); setAffBalanceDialogOpen(true); }} title="Adicionar saldo">
                              <Plus className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedAffiliate(aff); setAffBalanceAmount(""); setAffDeductDialogOpen(true); }} title="Deduzir saldo">
                              <ArrowDownToLine className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedAffiliate(aff); setAffEditBalance((aff.balance_cents / 100).toFixed(2)); setAffEditDialogOpen(true); }} title="Editar saldo">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => toggleAffiliate(aff.id, aff.is_active)} title={aff.is_active ? "Desativar" : "Ativar"}>
                              {aff.is_active ? <X className="h-4 w-4 text-muted-foreground" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => removeAffiliate(aff.id)} title="Remover">
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

      {/* Affiliate Create Dialog */}
      <Dialog open={affiliateDialogOpen} onOpenChange={setAffiliateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Afiliado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={affiliateMode === "existing" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setAffiliateMode("existing")}
              >
                Usuário Existente
              </Button>
              <Button
                variant={affiliateMode === "new" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setAffiliateMode("new")}
              >
                Criar Novo
              </Button>
            </div>

            {affiliateMode === "existing" ? (
              <div className="space-y-2">
                <Label>Selecionar Usuário</Label>
                <Select value={selectedUserForAffiliate} onValueChange={setSelectedUserForAffiliate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u) => !affiliates.some((a) => a.user_id === u.id))
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email} ({u.roles.join(", ")})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={newAffiliateName}
                    onChange={(e) => setNewAffiliateName(e.target.value)}
                    placeholder="Nome do afiliado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={newAffiliateEmail}
                    onChange={(e) => setNewAffiliateEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <Input
                    type="password"
                    value={newAffiliatePassword}
                    onChange={(e) => setNewAffiliatePassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setAffiliateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={createAffiliate} className="flex-1">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Affiliate Add Balance Dialog */}
      <Dialog open={affBalanceDialogOpen} onOpenChange={setAffBalanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Saldo ao Afiliado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{selectedAffiliate?.user_name}</p>
              <p className="text-muted-foreground">{selectedAffiliate?.user_email}</p>
              <p className="text-sm mt-1">Saldo atual: <span className="font-bold text-primary">{formatPrice(selectedAffiliate?.balance_cents || 0)}</span></p>
            </div>
            <div className="space-y-2">
              <Label>Valor a adicionar (R$)</Label>
              <Input type="number" step="0.01" min="0.01" value={affBalanceAmount} onChange={(e) => setAffBalanceAmount(e.target.value)} placeholder="10.00" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setAffBalanceDialogOpen(false)}>Cancelar</Button>
              <Button onClick={addAffiliateBalance} className="flex-1">
                <Plus className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Affiliate Deduct Balance Dialog */}
      <Dialog open={affDeductDialogOpen} onOpenChange={setAffDeductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deduzir Saldo do Afiliado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{selectedAffiliate?.user_name}</p>
              <p className="text-muted-foreground">{selectedAffiliate?.user_email}</p>
              <p className="text-sm mt-1">Saldo atual: <span className="font-bold text-primary">{formatPrice(selectedAffiliate?.balance_cents || 0)}</span></p>
            </div>
            <div className="space-y-2">
              <Label>Valor a deduzir (R$)</Label>
              <Input type="number" step="0.01" min="0.01" value={affBalanceAmount} onChange={(e) => setAffBalanceAmount(e.target.value)} placeholder="10.00" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setAffDeductDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={deductAffiliateBalance} className="flex-1">
                <ArrowDownToLine className="mr-2 h-4 w-4" /> Deduzir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Affiliate Edit Balance Dialog */}
      <Dialog open={affEditDialogOpen} onOpenChange={setAffEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Saldo do Afiliado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{selectedAffiliate?.user_name}</p>
              <p className="text-muted-foreground">{selectedAffiliate?.user_email}</p>
              <p className="text-sm mt-1">Saldo atual: <span className="font-bold text-primary">{formatPrice(selectedAffiliate?.balance_cents || 0)}</span></p>
            </div>
            <div className="space-y-2">
              <Label>Novo saldo (R$)</Label>
              <Input type="number" step="0.01" min="0" value={affEditBalance} onChange={(e) => setAffEditBalance(e.target.value)} placeholder="0.00" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setAffEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={editAffiliateBalance} className="flex-1">
                <Pencil className="mr-2 h-4 w-4" /> Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Deduct Balance Dialog */}
      <Dialog open={deductDialogOpen} onOpenChange={setDeductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirar Saldo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{deductUser?.full_name || deductUser?.email}</p>
              <p className="text-muted-foreground">Saldo atual: {deductUser ? formatPrice(deductUser.balance_cents) : "—"}</p>
            </div>
            <div className="space-y-2">
              <Label>Valor a retirar (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={deductAmount}
                onChange={(e) => setDeductAmount(e.target.value)}
                placeholder="10.00"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeductDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={deductBalance} className="flex-1">
                <ArrowDownToLine className="mr-2 h-4 w-4" /> Retirar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Reset Password Dialog */}
      <Dialog open={resetPwDialogOpen} onOpenChange={setResetPwDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{resetPwUser?.full_name || resetPwUser?.email}</p>
              <p className="text-muted-foreground">{resetPwUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={resetPwValue}
                onChange={(e) => setResetPwValue(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setResetPwDialogOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!resetPwUser || !resetPwValue || resetPwValue.length < 6) {
                    toast.error("Senha deve ter no mínimo 6 caracteres");
                    return;
                  }
                  const { data, error } = await supabase.functions.invoke("manage-users", {
                    body: { action: "reset_password", user_id: resetPwUser.id, new_password: resetPwValue },
                  });
                  if (error || data?.error) {
                    toast.error(data?.error || "Erro ao resetar senha");
                    return;
                  }
                  toast.success("Senha resetada com sucesso!");
                  setResetPwDialogOpen(false);
                }}
              >
                <KeyRound className="mr-2 h-4 w-4" /> Resetar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={confirmPayDialogOpen} onOpenChange={setConfirmPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{selectedWithdrawal?.user_name}</p>
              <p className="text-muted-foreground">{selectedWithdrawal?.user_email}</p>
              <p className="text-lg font-bold text-primary mt-1">
                {selectedWithdrawal ? formatPrice(selectedWithdrawal.amount_cents) : "—"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Comprovante de pagamento (opcional)</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => confirmPayment(false)} className="w-full" variant="default">
                <Check className="mr-2 h-4 w-4" /> Confirmar sem comprovante
              </Button>
              {paymentProofFile && (
                <Button onClick={() => confirmPayment(true)} className="w-full" variant="outline">
                  <Upload className="mr-2 h-4 w-4" /> Confirmar com comprovante
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={() => setConfirmPayDialogOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
