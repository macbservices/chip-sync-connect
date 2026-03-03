import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, Loader2, MessageSquarePlus, TicketCheck,
  Clock, CheckCircle2, XCircle
} from "lucide-react";
import macChipLogo from "@/assets/mac-chip-logo.png";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  screenshot_url: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

const Support = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"new" | "list">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Form
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/auth"); return; }
      setUserId(data.session.user.id);
      fetchTickets();
    });
  }, []);

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setTickets(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Preencha o assunto e a mensagem");
      return;
    }
    if (!screenshot) {
      toast.error("O print do problema é obrigatório");
      return;
    }
    if (!userId) return;

    setSubmitting(true);
    try {
      const ext = screenshot.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ticket-screenshots")
        .upload(path, screenshot, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject: subject.trim(),
          message: message.trim(),
          screenshot_url: path,
        });

      if (insertError) throw insertError;

      toast.success("Ticket enviado com sucesso!");
      setSubject("");
      setMessage("");
      setScreenshot(null);
      setTab("list");
      fetchTickets();
    } catch (err: any) {
      toast.error("Erro ao enviar ticket: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Aberto</Badge>;
      case "in_progress":
        return <Badge className="bg-primary gap-1"><Loader2 className="h-3 w-3" /> Em andamento</Badge>;
      case "resolved":
        return <Badge className="bg-accent text-accent-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> Resolvido</Badge>;
      case "closed":
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Fechado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container flex h-16 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/store")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <img src={macChipLogo} alt="Mac Chip" className="h-9 w-9 rounded-lg object-contain" />
            <span className="text-xl font-bold">Suporte</span>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant={tab === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("list")}
            >
              <TicketCheck className="mr-1 h-4 w-4" />
              Meus Tickets
            </Button>
            <Button
              variant={tab === "new" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("new")}
            >
              <MessageSquarePlus className="mr-1 h-4 w-4" />
              Novo Ticket
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="mx-auto max-w-2xl space-y-6">

          {tab === "new" && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquarePlus className="h-5 w-5 text-primary" />
                  Abrir Ticket
                </CardTitle>
                <CardDescription>
                  Descreva seu problema e envie um print obrigatório.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Problema com recarga"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Descrição do problema</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Descreva detalhadamente o problema que está enfrentando..."
                    rows={5}
                    maxLength={1000}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Print do problema (obrigatório)</Label>
                  <label className="block cursor-pointer">
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      screenshot ? "border-accent bg-accent/10" : "border-muted-foreground/30 hover:border-primary/50"
                    }`}>
                      {screenshot ? (
                        <div className="space-y-1">
                          <CheckCircle2 className="mx-auto h-6 w-6 text-accent" />
                          <p className="text-sm font-medium">{screenshot.name}</p>
                          <p className="text-xs text-muted-foreground">Clique para trocar</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                          <p className="text-sm font-medium">Clique para enviar o print</p>
                          <p className="text-xs text-muted-foreground">JPG, PNG ou PDF</p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setScreenshot(file);
                      }}
                    />
                  </label>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !subject.trim() || !message.trim() || !screenshot}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><MessageSquarePlus className="mr-2 h-4 w-4" /> Enviar Ticket</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {tab === "list" && (
            <>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </div>
              ) : tickets.length === 0 ? (
                <Card className="shadow-sm">
                  <CardContent className="py-12 text-center">
                    <TicketCheck className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">Nenhum ticket encontrado.</p>
                    <Button className="mt-4" onClick={() => setTab("new")}>
                      <MessageSquarePlus className="mr-2 h-4 w-4" /> Abrir Ticket
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <Card key={ticket.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusBadge(ticket.status)}
                              <span className="text-xs text-muted-foreground">
                                {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            <h3 className="font-semibold truncate">{ticket.subject}</h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.message}</p>
                            {ticket.admin_notes && (
                              <div className="mt-2 p-2 rounded bg-muted text-sm">
                                <p className="font-medium text-xs text-muted-foreground mb-1">Resposta do suporte:</p>
                                <p>{ticket.admin_notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Support;
