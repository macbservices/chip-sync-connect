import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, DollarSign, Users, TrendingUp, LogOut, ArrowDownToLine, Wallet, LayoutDashboard, ShoppingCart, Shield } from "lucide-react";
import macChipLogo from "@/assets/mac-chip-logo.png";
import NotificationBell from "@/components/NotificationBell";
import { DarkModeToggle } from "@/components/DarkModeToggle";

type AffiliateData = {
  id: string;
  referral_code: string;
  is_active: boolean;
  balance_cents: number;
};

type Commission = {
  id: string;
  amount_cents: number;
  commission_type: string;
  created_at: string;
  order_id: string | null;
};

const formatPrice = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const Affiliate = () => {
  const navigate = useNavigate();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [referredCount, setReferredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }

    // Fetch user roles
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setUserRoles((rolesData || []).map((r: any) => r.role));

    const { data: aff } = await supabase
      .from("affiliates")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!aff) {
      navigate("/sem-acesso");
      return;
    }

    setAffiliate(aff as any);

    const { data: comms } = await supabase
      .from("affiliate_commissions")
      .select("*")
      .eq("affiliate_id", aff.id)
      .order("created_at", { ascending: false });

    setCommissions((comms as any) || []);

    // Count referred users
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by_affiliate_id", aff.id);

    setReferredCount(count || 0);
    setLoading(false);
  };

  const copyLink = () => {
    if (!affiliate) return;
    const link = `${window.location.origin}/auth?ref=${affiliate.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleWithdraw = async () => {
    if (!affiliate) return;
    const amount = Math.round(parseFloat(withdrawAmount) * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (amount > affiliate.balance_cents) {
      toast.error("Saldo insuficiente");
      return;
    }
    setWithdrawLoading(true);
    const { error } = await supabase.rpc("affiliate_withdraw", { _amount_cents: amount });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Solicitação de saque enviada!");
      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      fetchData();
    }
    setWithdrawLoading(false);
  };

  const totalEarned = commissions.reduce((s, c) => s + c.amount_cents, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={macChipLogo} alt="Mac Chip" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-lg">Afiliados</span>
          </div>
          <div className="flex items-center gap-1">
            {userRoles.includes("collaborator") && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Colaborador</span>
              </Button>
            )}
            {userRoles.includes("customer") && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/store")}>
                <ShoppingCart className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Loja</span>
              </Button>
            )}
            {userRoles.includes("admin") && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            <NotificationBell />
            <DarkModeToggle />
            <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatPrice(affiliate?.balance_cents || 0)}</p>
              <p className="text-xs text-muted-foreground">Saldo Disponível</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{referredCount}</p>
              <p className="text-xs text-muted-foreground">Indicados</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatPrice(totalEarned)}</p>
              <p className="text-xs text-muted-foreground">Total Ganho</p>
            </div>
          </Card>
        </div>

        {/* Referral Link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seu Link de Indicação</CardTitle>
            <CardDescription>Compartilhe este link para ganhar 20% de comissão em cada venda dos seus indicados</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              readOnly
              value={`${window.location.origin}/auth?ref=${affiliate?.referral_code || ""}`}
              className="font-mono text-sm"
            />
            <Button onClick={copyLink} variant="outline" size="icon">
              <Copy className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Withdraw */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Saque</CardTitle>
              <CardDescription>Solicite o saque do seu saldo de comissões</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setWithdrawDialogOpen(true)}
              disabled={!affiliate || affiliate.balance_cents <= 0}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" /> Solicitar Saque
            </Button>
          </CardHeader>
        </Card>

        {/* Commissions History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Comissões</CardTitle>
            <CardDescription>{commissions.length} comissões registradas</CardDescription>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <DollarSign className="mx-auto h-10 w-10 mb-3 opacity-30" />
                <p>Nenhuma comissão ainda. Compartilhe seu link!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Badge variant="secondary">
                          {c.commission_type === "customer_purchase" ? "Compra Cliente" : "Venda Colaborador"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatPrice(c.amount_cents)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">Saldo disponível</p>
              <p className="text-xl font-bold text-primary">{formatPrice(affiliate?.balance_cents || 0)}</p>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Valor em R$"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <Button onClick={handleWithdraw} className="w-full" disabled={withdrawLoading}>
              {withdrawLoading ? "Processando..." : "Confirmar Saque"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Affiliate;
