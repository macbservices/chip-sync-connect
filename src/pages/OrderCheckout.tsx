import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Smartphone, Upload, ArrowLeft, Copy, QrCode } from "lucide-react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price_cents: number;
  duration_minutes: number | null;
};

const OrderCheckout = () => {
  const navigate = useNavigate();
  const { serviceId } = useParams<{ serviceId: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, [serviceId]);

  const checkAuthAndLoad = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?redirect=/order/" + serviceId);
      return;
    }
    if (serviceId) {
      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("id", serviceId)
        .eq("is_active", true)
        .single();
      setService(data);
    }
    setLoading(false);
  };

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleSubmit = async () => {
    if (!service) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let proofUrl: string | null = null;

      if (proofFile) {
        const ext = proofFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("pix-proofs")
          .upload(path, proofFile);
        if (uploadError) throw uploadError;
        proofUrl = path;
      }

      const { error } = await supabase.from("orders").insert({
        customer_id: user.id,
        service_id: service.id,
        amount_cents: service.price_cents,
        pix_proof_url: proofUrl,
        status: proofUrl ? "pending_payment" : "pending_payment",
      });

      if (error) throw error;

      toast.success("Pedido criado! Aguarde a aprovação do pagamento.");
      navigate("/my-orders");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p>Serviço não encontrado.</p>
            <Button className="mt-4" onClick={() => navigate("/store")}>
              Voltar à loja
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <span className="text-xl font-bold">Finalizar Pedido</span>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Service summary */}
          <Card>
            <CardHeader>
              <CardTitle>{service.name}</CardTitle>
              {service.description && (
                <CardDescription>{service.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant={service.type === "verification" ? "default" : "secondary"}>
                  {service.type === "verification" ? "Verificação" : "Aluguel"}
                </Badge>
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(service.price_cents)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* PIX payment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Pagamento via PIX
              </CardTitle>
              <CardDescription>
                Faça o PIX e envie o comprovante para aprovação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Chave PIX</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-lg font-mono font-semibold">
                    contato@chipsms.com
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText("contato@chipsms.com");
                      toast.success("Chave PIX copiada!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm font-semibold text-primary">
                  Valor: {formatPrice(service.price_cents)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proof">Comprovante do PIX (opcional agora)</Label>
                <Input
                  id="proof"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  Você pode enviar o comprovante depois em "Meus Pedidos"
                </p>
              </div>

              <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
                {submitting ? (
                  "Criando pedido..."
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Confirmar Pedido
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default OrderCheckout;
