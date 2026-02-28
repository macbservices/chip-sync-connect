import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Smartphone, ArrowLeft, QrCode, Copy, Upload, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

const PIX_KEY = "2eb9e41e-13e9-4ad9-95c2-634008562008";

const Recharge = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [done, setDone] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState<string | null>(null);
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
    if (!proofFile) {
      toast.error("Anexe o comprovante PIX para verificação automática");
      return;
    }
    setSubmitting(true);
    setVerifyFailed(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const amountCents = Math.round(parseFloat(amount) * 100);

      // Upload proof
      const ext = proofFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("pix-proofs")
        .upload(path, proofFile);
      if (uploadError) throw uploadError;

      // Create recharge request
      const { data: rechargeData, error } = await supabase.from("recharge_requests").insert({
        user_id: user.id,
        amount_cents: amountCents,
        pix_proof_url: path,
      }).select("id").single();

      if (error) throw error;

      // Now verify with AI
      setSubmitting(false);
      setVerifying(true);

      const { data: verifyResult, error: verifyError } = await supabase.functions.invoke("verify-pix", {
        body: { recharge_id: rechargeData.id },
      });

      if (verifyError) {
        console.error("Verify error:", verifyError);
        setVerifyFailed("Não foi possível verificar automaticamente. O admin será notificado.");
        setDone(true);
        setVerifying(false);
        return;
      }

      if (verifyResult?.approved) {
        setAutoApproved(true);
        setDone(true);
      } else {
        setVerifyFailed(verifyResult?.reason || "O comprovante não pôde ser aprovado automaticamente.");
        setDone(true);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
      setVerifying(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="p-10 text-center space-y-5">
            {autoApproved ? (
              <>
                <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
                <h2 className="text-2xl font-bold">Saldo creditado!</h2>
                <p className="text-muted-foreground">
                  Seu comprovante foi verificado automaticamente e o saldo já foi adicionado à sua conta.
                </p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-16 w-16 text-muted-foreground" />
                <h2 className="text-2xl font-bold">Verificação pendente</h2>
                <p className="text-muted-foreground">
                  {verifyFailed || "O comprovante será analisado pelo administrador. Seu saldo será creditado após a confirmação."}
                </p>
              </>
            )}
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

          {/* Verifying overlay */}
          {verifying && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-8 text-center space-y-4">
                <RefreshCw className="mx-auto h-10 w-10 animate-spin text-primary" />
                <h3 className="text-lg font-semibold">Verificando comprovante...</h3>
                <p className="text-sm text-muted-foreground">
                  A IA está analisando seu comprovante PIX. Isso pode levar alguns segundos.
                </p>
              </CardContent>
            </Card>
          )}

          {/* PIX Payment Card */}
          {!verifying && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  Pagamento via PIX
                </CardTitle>
                <CardDescription>
                  Envie o PIX para a chave abaixo e anexe o comprovante. A verificação é automática!
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
                  <Label htmlFor="proof" className="font-medium">Comprovante do PIX *</Label>
                  <Input
                    id="proof"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    📸 Tire uma foto ou capture a tela do comprovante PIX
                  </p>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !amount || !proofFile}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? "Enviando..." : (
                    <><Upload className="mr-2 h-4 w-4" />Enviar e Verificar Automaticamente</>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  A IA verificará o comprovante automaticamente. Se não for possível, o administrador analisará manualmente.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Recharge;
