import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Smartphone, ArrowLeft, QrCode as QrCodeIcon, Copy, CheckCircle2,
  Loader2, Upload, Mail, AlertCircle
} from "lucide-react";

const PIX_KEY = "aylaluanagoncalves@gmail.com";
const PIX_KEY_TYPE = "E-mail";

type Step = "amount" | "pay" | "upload" | "verifying" | "done" | "failed";

const Recharge = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("amount");
  const [rechargeId, setRechargeId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ reason?: string; amount_found?: number } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/auth"); return; }
      setUserId(data.session.user.id);
      supabase.from("profiles").select("balance_cents").eq("user_id", data.session.user.id).single()
        .then(({ data: p }) => setBalance(p?.balance_cents ?? 0));
    });
  }, []);

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const amountCents = Math.round(parseFloat(amount || "0") * 100);

  // Step 1: Create recharge request and go to payment step
  const handleProceed = async () => {
    if (!amount || parseFloat(amount) < 5) {
      toast.error("Valor mínimo R$ 5,00");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("recharge_requests")
        .insert({ user_id: userId!, amount_cents: amountCents, status: "pending" })
        .select("id")
        .single();

      if (error) throw error;
      setRechargeId(data.id);
      setStep("pay");
    } catch (err: any) {
      toast.error("Erro ao criar solicitação: " + err.message);
    }
  };

  // Step 2: Upload proof
  const handleUploadProof = async (file: File) => {
    if (!rechargeId || !userId) return;
    setUploading(true);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${rechargeId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("pix-proofs")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Save proof path to recharge
      const { error: updateError } = await supabase
        .from("recharge_requests")
        .update({ pix_proof_url: path })
        .eq("id", rechargeId);

      if (updateError) throw updateError;

      // Now verify with AI
      setStep("verifying");
      await verifyProof();
    } catch (err: any) {
      toast.error("Erro ao enviar comprovante: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Step 3: Call verify-pix
  const verifyProof = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-pix", {
        body: { recharge_id: rechargeId },
      });

      if (error) throw error;

      if (data?.approved) {
        setStep("done");
        toast.success("Pagamento verificado! Saldo creditado automaticamente.");
      } else {
        setVerifyResult({ reason: data?.reason, amount_found: data?.amount_found });
        setStep("failed");
      }
    } catch (err: any) {
      setVerifyResult({ reason: err.message });
      setStep("failed");
    }
  };

  const handleRetry = () => {
    setVerifyResult(null);
    setStep("pay");
  };

  // === SCREENS ===

  // Done screen
  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="p-10 text-center space-y-5">
            <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
            <h2 className="text-2xl font-bold">Pagamento confirmado!</h2>
            <p className="text-muted-foreground">
              Seu PIX foi verificado e o saldo de {formatPrice(amountCents)} já foi creditado automaticamente.
            </p>
            <Button className="w-full" size="lg" onClick={() => navigate("/store")}>
              Voltar à loja
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verifying screen
  if (step === "verifying") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="p-10 text-center space-y-5">
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-primary" />
            <h2 className="text-xl font-bold">Verificando comprovante...</h2>
            <p className="text-muted-foreground text-sm">
              Nossa IA está analisando seu comprovante PIX. Isso leva apenas alguns segundos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Failed screen
  if (step === "failed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="p-10 text-center space-y-5">
            <AlertCircle className="mx-auto h-14 w-14 text-destructive" />
            <h2 className="text-xl font-bold">Verificação falhou</h2>
            <p className="text-muted-foreground text-sm">
              {verifyResult?.reason || "Não foi possível verificar o comprovante automaticamente."}
            </p>
            {verifyResult?.amount_found !== undefined && (
              <p className="text-sm text-muted-foreground">
                Valor encontrado: {formatPrice(Math.round((verifyResult.amount_found || 0) * 100))} — Esperado: {formatPrice(amountCents)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Sua solicitação foi enviada para análise manual do administrador.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleRetry}>
                Tentar novamente
              </Button>
              <Button className="flex-1" onClick={() => navigate("/store")}>
                Voltar à loja
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pay screen - show PIX key + upload
  if (step === "pay") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="container flex h-16 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setStep("amount")}>
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
            {/* Amount */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5 text-center">
                <p className="text-sm text-muted-foreground">Valor da recarga</p>
                <p className="text-3xl font-bold text-primary">{formatPrice(amountCents)}</p>
              </CardContent>
            </Card>

            {/* PIX Key */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  1. Faça o PIX para a chave abaixo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{PIX_KEY_TYPE}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={PIX_KEY} className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(PIX_KEY);
                        toast.success("Chave PIX copiada!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Envie exatamente <strong>{formatPrice(amountCents)}</strong> para que a verificação automática funcione corretamente.
                </p>
              </CardContent>
            </Card>

            {/* Upload Proof */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  2. Envie o comprovante
                </CardTitle>
                <CardDescription>
                  Tire um print ou screenshot do comprovante PIX e envie abaixo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    {uploading ? (
                      <div className="space-y-2">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Enviando...</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">Clique para enviar o comprovante</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG ou PDF</p>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadProof(file);
                    }}
                  />
                </label>
              </CardContent>
            </Card>

            <p className="text-xs text-center text-muted-foreground">
              💡 A verificação é 100% automática por IA. Seu saldo será creditado em segundos!
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Amount screen (initial)
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

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="h-5 w-5 text-primary" />
                Recarga via PIX
              </CardTitle>
              <CardDescription>
                Informe o valor, faça o PIX e envie o comprovante. A IA verifica e credita seu saldo automaticamente!
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
                onClick={handleProceed}
                disabled={!amount || parseFloat(amount) < 5}
                className="w-full"
                size="lg"
              >
                <QrCodeIcon className="mr-2 h-4 w-4" />
                Continuar para pagamento
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                💡 Verificação automática por IA — sem necessidade de aprovação manual!
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Recharge;
