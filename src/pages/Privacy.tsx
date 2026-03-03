import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <span className="font-bold">Política de Privacidade</span>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-10 space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          🔒 Política de Privacidade
        </h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        <p className="text-muted-foreground leading-relaxed">
          A <strong className="text-foreground">MAC CHIP</strong> está comprometida com a proteção dos dados pessoais de seus usuários, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD) e demais legislações aplicáveis.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">1. Controlador de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            O controlador dos dados pessoais coletados por esta plataforma é a <strong className="text-foreground">MAC CHIP</strong>, acessível pelo endereço eletrônico da plataforma. Para exercer seus direitos como titular de dados, entre em contato através do e-mail disponibilizado na plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">2. Dados Pessoais Coletados</h2>
          <p className="text-muted-foreground leading-relaxed">Coletamos os seguintes dados pessoais:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
            <li><strong>Dados de cadastro:</strong> endereço de e-mail, nome completo (quando fornecido).</li>
            <li><strong>Dados de autenticação:</strong> credenciais de acesso (senha armazenada de forma criptografada).</li>
            <li><strong>Dados transacionais:</strong> histórico de compras, recargas, saldo e comprovantes de pagamento (PIX).</li>
            <li><strong>Dados de uso:</strong> endereço IP, tipo de navegador, páginas acessadas, data e hora de acesso.</li>
            <li><strong>Dados de SMS:</strong> conteúdo dos SMS recebidos nos chips temporários durante a sessão ativa do usuário.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">3. Finalidades do Tratamento</h2>
          <p className="text-muted-foreground leading-relaxed">Os dados pessoais são tratados para as seguintes finalidades:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
            <li><strong>Execução do contrato:</strong> prestação do serviço de recebimento de SMS (Art. 7º, V, LGPD).</li>
            <li><strong>Segurança e prevenção de fraudes:</strong> análise automatizada de SMS para detectar divergências de serviço (Art. 7º, IX, LGPD).</li>
            <li><strong>Cumprimento de obrigação legal:</strong> manutenção de registros conforme legislação fiscal e o Marco Civil da Internet (Art. 7º, II, LGPD).</li>
            <li><strong>Legítimo interesse:</strong> melhoria dos serviços e análise estatística (Art. 7º, IX, LGPD).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">4. Compartilhamento de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Os dados pessoais <strong className="text-foreground">não são vendidos, alugados ou compartilhados</strong> com terceiros para fins comerciais. Poderão ser compartilhados apenas:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
            <li>Com provedores de infraestrutura essenciais à operação da plataforma (hospedagem, banco de dados, processamento de pagamentos).</li>
            <li>Mediante ordem judicial ou requisição de autoridade competente.</li>
            <li>Para proteção dos direitos da MAC CHIP em processos judiciais ou administrativos.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">5. Armazenamento e Segurança</h2>
          <p className="text-muted-foreground leading-relaxed">
            Os dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso. Implementamos controle de acesso baseado em funções (RBAC), políticas de segurança a nível de linha (RLS) no banco de dados e autenticação segura para proteger os dados contra acessos não autorizados.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Os dados de SMS recebidos são mantidos apenas pelo período necessário para a prestação do serviço e detecção de fraudes, sendo excluídos periodicamente.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">6. Retenção de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Os dados pessoais são retidos pelo tempo necessário para cumprir as finalidades para as quais foram coletados, incluindo obrigações legais de retenção. Dados transacionais são mantidos pelo prazo legal exigido (mínimo de 5 anos para fins fiscais). Dados de uso e logs de acesso são mantidos por 6 meses conforme o Marco Civil da Internet.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">7. Direitos do Titular (LGPD)</h2>
          <p className="text-muted-foreground leading-relaxed">
            Em conformidade com os artigos 17 a 22 da LGPD, o titular dos dados tem direito a:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
            <li><strong>Confirmação e acesso:</strong> saber se seus dados são tratados e obter cópia.</li>
            <li><strong>Correção:</strong> solicitar a atualização de dados incompletos ou desatualizados.</li>
            <li><strong>Anonimização, bloqueio ou eliminação:</strong> para dados desnecessários ou tratados em desconformidade.</li>
            <li><strong>Portabilidade:</strong> transferir seus dados a outro fornecedor de serviço.</li>
            <li><strong>Eliminação:</strong> solicitar a exclusão de dados tratados com base em consentimento.</li>
            <li><strong>Revogação do consentimento:</strong> quando o tratamento se basear nesta hipótese.</li>
            <li><strong>Oposição:</strong> opor-se ao tratamento quando em desconformidade com a LGPD.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Para exercer qualquer desses direitos, entre em contato através dos canais disponibilizados na plataforma. As solicitações serão atendidas no prazo de 15 (quinze) dias úteis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">8. Transferência Internacional de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Os dados poderão ser armazenados em servidores localizados fora do Brasil. Nestes casos, garantimos que o país de destino proporciona nível adequado de proteção de dados ou que são adotadas garantias contratuais apropriadas, conforme previsto na LGPD.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">9. Menores de Idade</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma não se destina a menores de 18 anos. Não coletamos intencionalmente dados de menores. Se tomarmos conhecimento de que dados de um menor foram coletados, providenciaremos sua exclusão imediata.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">10. Alterações nesta Política</h2>
          <p className="text-muted-foreground leading-relaxed">
            Esta Política poderá ser atualizada periodicamente. Notificaremos os usuários sobre alterações significativas através da plataforma. O uso continuado após alterações constitui aceitação da nova Política.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">11. Contato e Encarregado (DPO)</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para dúvidas sobre esta Política de Privacidade ou para exercer seus direitos como titular de dados, entre em contato através dos canais de atendimento disponibilizados na plataforma.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Caso entenda que o tratamento dos seus dados pessoais viola a LGPD, você poderá apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD) — <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.gov.br/anpd</a>.
          </p>
        </section>

        <div className="pt-6 border-t flex flex-wrap gap-4 text-sm">
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/termos")}>
            Termos de Uso
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

export default Privacy;
