import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Smartphone, ArrowLeft, QrCode, Copy, Upload, CheckCircle2 } from "lucide-react";

const PIX_KEY = "2eb9e41e-13e9-4ad9-95c2-634008562008";

const Recharge = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/auth"); return; }
      supabase.from("profiles").select("balance_cents").eq("user_id", data.session.user.id).single()
        .then(({ data: p }) => setBalance(p?.balance_cents ?? 0));
    });
  }, []);

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) < 5) {
      toast.error("Valor mínimo de recarga é R$ 5,00");
      return;
    }
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const amountCents = Math.round(parseFloat(amount) * 100);
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

      const { error } = await supabase.from("recharge_requests").insert({
        user_id: user.id,
        amount_cents: amountCents,
        pix_proof_url: proofUrl,
      });

      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="p-10 text-center space-y-5">
            <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
            <h2 className="text-2xl font-bold">Solicitação enviada!</h2>
            <p className="text-muted-foreground">
              Seu saldo será creditado após confirmação do pagamento pelo administrador. Isso pode levar alguns minutos.
            </p>
            <Button className="w-full" size="lg" onClick={() => navigate("/store")}>
              Voltar à loja
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

          {/* PIX Payment Card */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                Pagamento via PIX
              </CardTitle>
              <CardDescription>
                Envie o PIX para a chave abaixo e anexe o comprovante
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* PIX Key */}
              <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chave PIX (Aleatória)</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-sm font-mono font-semibold text-foreground break-all">{PIX_KEY}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8"
                    onClick={() => {
                      navigator.clipboard.writeText(PIX_KEY);
                      toast.success("Chave PIX copiada!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Amount */}
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

              {/* Proof */}
              <div className="space-y-2">
                <Label htmlFor="proof" className="font-medium">Comprovante do PIX <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  id="proof"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !amount}
                className="w-full"
                size="lg"
              >
                {submitting ? "Enviando..." : (
                  <><Upload className="mr-2 h-4 w-4" />Solicitar Recarga</>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Após o envio, o administrador confirmará o pagamento e seu saldo será creditado automaticamente.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Recharge;
