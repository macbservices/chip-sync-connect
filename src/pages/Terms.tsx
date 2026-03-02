import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold">Termos de Uso</span>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-10 space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          📄 Termos de Uso e Política Anti-Fraude
        </h1>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">1. Objeto do Serviço</h2>
          <p className="text-muted-foreground leading-relaxed">
            O site fornece o recebimento de códigos de confirmação (SMS) de forma temporária e unitária, utilizando SIM Cards físicos (chips reais) para garantir a máxima taxa de aprovação em serviços que bloqueiam números virtuais (VOIP).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">2. Política de Recebimento Único</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cada contratação dá direito ao recebimento de um (1) único SMS para o serviço especificamente selecionado pelo usuário no momento da compra.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            O sistema não garante o reuso do número após a expiração da sessão (geralmente 15-20 minutos).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">3. Monitoramento e Inteligência Artificial Anti-Fraude</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para garantir a viabilidade do negócio e a segurança dos nossos chips, utilizamos um sistema de Inteligência Artificial (IA) que analisa o conteúdo de todos os SMS recebidos em tempo real.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Divergência de Serviço:</strong> Se o usuário contratar um serviço de baixo valor (ex: TikTok) e o SMS recebido for de um serviço de alto valor ou restrito (ex: WhatsApp, Bancos, Claude), a IA identificará a fraude instantaneamente.
          </p>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <p className="font-semibold text-destructive">Penalidades em caso de tentativa de burla:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
              <li>Bloquear a visualização do código SMS.</li>
              <li>Encerrar a sessão do número imediatamente.</li>
              <li>Suspender a conta do usuário sem direito a reembolso do saldo remanescente, devido à violação direta dos termos de uso.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">4. Reembolsos e Falhas</h2>
          <p className="text-muted-foreground leading-relaxed">
            O saldo só será estornado para a carteira do usuário se o SMS não chegar dentro do tempo de validade da sessão, desde que não haja tentativa de fraude detectada.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Uma vez que o código SMS é exibido ao usuário, o serviço é considerado prestado e não haverá estorno.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">5. Responsabilidade de Uso</h2>
          <p className="text-muted-foreground leading-relaxed">
            O usuário é o único responsável pelo uso das contas criadas através dos nossos números. Não permitimos o uso de nossos serviços para atividades ilícitas, spam excessivo ou qualquer prática que viole as leis brasileiras.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Terms;
