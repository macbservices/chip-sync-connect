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
          📄 Termos de Uso e Condições Gerais
        </h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">1. Identificação do Prestador</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma <strong className="text-foreground">MAC CHIP</strong> é um serviço digital de recebimento temporário de mensagens SMS para verificação de contas, operado sob as leis da República Federativa do Brasil.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">2. Objeto do Serviço</h2>
          <p className="text-muted-foreground leading-relaxed">
            A MAC CHIP fornece o recebimento de códigos de confirmação (SMS) de forma temporária e unitária, utilizando SIM Cards físicos (chips reais) para garantir a máxima taxa de aprovação em serviços que bloqueiam números virtuais (VOIP).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">3. Aceitação dos Termos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Ao criar uma conta ou utilizar qualquer funcionalidade da plataforma, o usuário declara ter lido, compreendido e aceito integralmente estes Termos de Uso, a Política de Privacidade e a Política de Cookies. Caso não concorde com qualquer disposição, o usuário deve cessar imediatamente o uso da plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">4. Elegibilidade e Cadastro</h2>
          <p className="text-muted-foreground leading-relaxed">
            O uso da plataforma é restrito a pessoas com idade mínima de 18 (dezoito) anos ou idade legal em sua jurisdição. O usuário é responsável por fornecer informações verdadeiras e manter a segurança de suas credenciais de acesso.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">5. Política de Recebimento Único</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cada contratação dá direito ao recebimento de um (1) único SMS para o serviço especificamente selecionado pelo usuário no momento da compra. O sistema não garante o reuso do número após a expiração da sessão (geralmente 15-20 minutos).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">6. Pagamentos e Recargas</h2>
          <p className="text-muted-foreground leading-relaxed">
            Os pagamentos são realizados exclusivamente via PIX. O saldo adicionado à conta do usuário é utilizado para a aquisição de serviços dentro da plataforma. Os valores pagos não são reembolsáveis em dinheiro, exceto nos casos previstos nestes Termos ou conforme determinação legal aplicável (Código de Defesa do Consumidor — Lei nº 8.078/1990).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">7. Monitoramento e Sistema Anti-Fraude</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para garantir a segurança e viabilidade do serviço, utilizamos um sistema automatizado que analisa o conteúdo dos SMS recebidos em tempo real.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Divergência de Serviço:</strong> Se o usuário contratar um serviço de baixo valor (ex: TikTok) e o SMS recebido for de um serviço diferente (ex: WhatsApp, Bancos), o sistema identificará a divergência.
          </p>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <p className="font-semibold text-destructive">Penalidades em caso de violação:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
              <li>Bloqueio da visualização do código SMS.</li>
              <li>Encerramento imediato da sessão do número.</li>
              <li>Suspensão ou cancelamento da conta sem direito a reembolso do saldo, devido à violação dos termos de uso.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">8. Reembolsos e Cancelamentos</h2>
          <p className="text-muted-foreground leading-relaxed">
            O saldo será estornado automaticamente para a carteira do usuário se o SMS não for recebido dentro do tempo de validade da sessão, desde que não haja tentativa de fraude detectada. Uma vez que o código SMS é exibido ao usuário, o serviço é considerado prestado e não haverá estorno.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            O usuário pode cancelar um pedido ativo antes do recebimento do SMS, recebendo estorno integral do valor. Após o recebimento, o cancelamento fica restrito à administração.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">9. Responsabilidade de Uso</h2>
          <p className="text-muted-foreground leading-relaxed">
            O usuário é o único responsável pelo uso das contas criadas através dos números fornecidos. É expressamente proibido utilizar o serviço para:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
            <li>Atividades ilícitas, ilegais ou contrárias à moral e aos bons costumes.</li>
            <li>Envio de spam, phishing ou qualquer forma de comunicação não solicitada.</li>
            <li>Fraude, estelionato ou qualquer prática que viole a legislação brasileira.</li>
            <li>Violação de termos de serviço de plataformas terceiras.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">10. Limitação de Responsabilidade</h2>
          <p className="text-muted-foreground leading-relaxed">
            A MAC CHIP não se responsabiliza por: (i) indisponibilidade temporária do serviço por motivos de força maior, manutenção ou falhas técnicas de terceiros; (ii) bloqueios realizados por plataformas terceiras nos números utilizados; (iii) uso indevido do serviço pelo usuário; (iv) perdas indiretas, consequentes ou lucros cessantes decorrentes do uso ou impossibilidade de uso do serviço.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">11. Propriedade Intelectual</h2>
          <p className="text-muted-foreground leading-relaxed">
            Todo o conteúdo da plataforma, incluindo marca, logotipo, layout, software e textos, é de propriedade exclusiva da MAC CHIP ou de seus licenciadores, sendo protegido pelas leis de propriedade intelectual vigentes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">12. Modificações dos Termos</h2>
          <p className="text-muted-foreground leading-relaxed">
            A MAC CHIP reserva-se o direito de alterar estes Termos a qualquer momento, mediante publicação da versão atualizada na plataforma. O uso continuado do serviço após alterações constitui aceitação dos novos termos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">13. Foro e Legislação Aplicável</h2>
          <p className="text-muted-foreground leading-relaxed">
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca do domicílio do usuário para dirimir quaisquer controvérsias oriundas deste instrumento, conforme o art. 101, I, do Código de Defesa do Consumidor.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">14. Disposições Gerais</h2>
          <p className="text-muted-foreground leading-relaxed">
            Se qualquer cláusula destes Termos for considerada inválida ou inexequível, as demais permanecerão em pleno vigor e efeito. A falha da MAC CHIP em exercer qualquer direito previsto nestes Termos não constituirá renúncia a tal direito.
          </p>
        </section>

        <div className="pt-6 border-t flex flex-wrap gap-4 text-sm">
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/privacidade")}>
            Política de Privacidade
          </Button>
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/cookies")}>
            Política de Cookies
          </Button>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MAC CHIP — Todos os direitos reservados
      </footer>
    </div>
  );
};

export default Terms;
