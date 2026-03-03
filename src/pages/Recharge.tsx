import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Smartphone, ArrowLeft, QrCode as QrCodeIcon, Copy, CheckCircle2, RefreshCw, XCircle, Loader2, Clock } from "lucide-react";

const Recharge = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);

  // Charge state
  const [creating, setCreating] = useState(false);
  const [charge, setCharge] = useState<{
    recharge_id: string;
    txid: string;
    pix_copy_paste: string;
    qr_code_image: string;
    expires_at: string;
  } | null>(null);

  // Payment polling
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/auth"); return; }
      supabase.from("profiles").select("balance_cents").eq("user_id", data.session.user.id).single()
        .then(({ data: p }) => setBalance(p?.balance_cents ?? 0));
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleCreateCharge = async () => {
    if (!amount || parseFloat(amount) < 5) {
      toast.error("Valor mínimo de recarga é R$ 5,00");
      return;
    }
    setCreating(true);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);

      const { data, error } = await supabase.functions.invoke("efi-pix", {
        body: { action: "create_charge", amount_cents: amountCents },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCharge(data);
      toast.success("Cobrança PIX gerada! Escaneie o QR Code para pagar.");

      // Start polling for payment every 5 seconds
      startPolling(data.recharge_id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar cobrança PIX");
    } finally {
      setCreating(false);
    }
  };

  const startPolling = (rechargeId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("efi-pix", {
          body: { action: "check_payment", recharge_id: rechargeId },
        });

        if (!error && data?.paid) {
          setPaid(true);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // silent
      }
    };

    // First check after 5s, then every 5s
    pollRef.current = setInterval(poll, 5000);
  };

  // Payment confirmed screen
  if (paid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="p-10 text-center space-y-5">
            <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
            <h2 className="text-2xl font-bold">Pagamento confirmado!</h2>
            <p className="text-muted-foreground">
              Seu PIX foi recebido e o saldo já foi creditado automaticamente na sua conta.
            </p>
            <Button className="w-full" size="lg" onClick={() => navigate("/store")}>
              Voltar à loja
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Charge created - show QR Code
  if (charge) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="container flex h-16 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setCharge(null); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Smartphone className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Pagamento PIX</span>
            </div>
          </div>
        </header>

        <main className="flex-1 container py-8">
          <div className="mx-auto max-w-md space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <QrCodeIcon className="h-5 w-5 text-primary" />
                  Pague {formatPrice(Math.round(parseFloat(amount) * 100))}
                </CardTitle>
                <CardDescription>
                  Escaneie o QR Code ou copie o código PIX abaixo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* QR Code */}
                {charge.qr_code_image && (
                  <div className="flex justify-center">
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <img
                        src={`data:image/png;base64,${charge.qr_code_image}`}
                        alt="QR Code PIX"
                        className="w-52 h-52"
                      />
                    </div>
                  </div>
                )}

                {/* Copy Paste */}
                {charge.pix_copy_paste && (
                  <div className="space-y-2">
                    <Label className="font-medium text-sm">PIX Copia e Cola</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={charge.pix_copy_paste}
                        className="text-xs font-mono"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(charge.pix_copy_paste);
                          toast.success("Código PIX copiado!");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
                  <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm font-medium">Aguardando pagamento...</p>
                  <p className="text-xs text-muted-foreground">
                    O saldo será creditado automaticamente após a confirmação do PIX.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <Clock className="h-3 w-3" />
                  <span>Expira em 1 hora</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Initial form
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container flex h-16 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/store")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Recarregar Saldo</span>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="mx-auto max-w-md space-y-6">
          {/* Current Balance */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Saldo atual</p>
                <p className="text-3xl font-bold text-primary mt-1">{formatPrice(balance)}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-7 w-7 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Amount Card */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="h-5 w-5 text-primary" />
                Recarga via PIX
              </CardTitle>
              <CardDescription>
                Informe o valor e gere a cobrança PIX automaticamente. O saldo é creditado instantaneamente após o pagamento!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="amount" className="font-medium">Valor da recarga (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="5"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex: 50"
                  className="h-11 text-lg"
                />
                <p className="text-xs text-muted-foreground">Valor mínimo: R$ 5,00</p>
              </div>

              <Button
                onClick={handleCreateCharge}
                disabled={creating || !amount || parseFloat(amount) < 5}
                className="w-full"
                size="lg"
              >
                {creating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando cobrança PIX...</>
                ) : (
                  <><QrCodeIcon className="mr-2 h-4 w-4" />Gerar QR Code PIX</>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                💡 O pagamento é verificado automaticamente. Sem necessidade de enviar comprovante!
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Recharge;
