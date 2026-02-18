import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Smartphone, ArrowLeft, QrCode, Copy, Upload } from "lucide-react";

const PIX_KEY = "contato@chipsms.com";

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
      toast.success("Solicitação enviada! O administrador irá confirmar em breve.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h2 className="text-xl font-bold">Solicitação enviada!</h2>
            <p className="text-muted-foreground">
              Seu saldo será creditado após confirmação do pagamento pelo administrador.
            </p>
            <Button className="w-full" onClick={() => navigate("/store")}>
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
            <span className="text-xl font-bold">Recarregar Saldo</span>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="mx-auto max-w-md space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Saldo atual</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{formatPrice(balance)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Pagamento via PIX
              </CardTitle>
              <CardDescription>
                Envie o PIX para a chave abaixo e depois envie o comprovante
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border bg-muted/50 p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Chave PIX</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-lg font-mono font-semibold">{PIX_KEY}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(PIX_KEY);
                      toast.success("Chave PIX copiada!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Valor da recarga (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="5"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex: 50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proof">Comprovante do PIX</Label>
                <Input
                  id="proof"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Recharge;
