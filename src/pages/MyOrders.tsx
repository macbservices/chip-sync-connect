import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Smartphone, ArrowLeft, ShoppingBag } from "lucide-react";

type Order = {
  id: string;
  status: string;
  amount_cents: number;
  phone_number: string | null;
  created_at: string;
  expires_at: string | null;
  service: { name: string; type: string } | null;
};

const MyOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    fetchOrders();
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, service:services(name, type)")
      .order("created_at", { ascending: false });
    setOrders((data as any) || []);
    setLoading(false);
  };

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending_payment: { label: "Aguardando Pagamento", variant: "outline" },
      paid: { label: "Pago", variant: "default" },
      active: { label: "Ativo", variant: "default" },
      completed: { label: "Concluído", variant: "secondary" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/store")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Meus Pedidos</span>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">Você ainda não fez nenhum pedido.</p>
            <Button className="mt-4" onClick={() => navigate("/store")}>
              Ver serviços
            </Button>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
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
                      <TableCell className="font-mono">
                        {order.phone_number || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default MyOrders;
