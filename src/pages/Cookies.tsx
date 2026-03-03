import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Cookie } from "lucide-react";

const Cookies = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" />
            <span className="font-bold">Política de Cookies</span>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-10 space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          🍪 Política de Cookies
        </h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">1. O que são Cookies?</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cookies são pequenos arquivos de texto armazenados no seu dispositivo (computador, smartphone ou tablet) quando você visita um site. Eles permitem que o site reconheça seu dispositivo e armazene informações sobre suas preferências e sessão.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">2. Cookies que Utilizamos</h2>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-semibold text-foreground">Cookies Essenciais (Obrigatórios)</p>
              <p className="text-muted-foreground text-sm">
                Necessários para o funcionamento básico da plataforma. Incluem cookies de autenticação e sessão que permitem que você faça login e navegue com segurança.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                <li><strong>Token de autenticação:</strong> mantém sua sessão de login ativa.</li>
                <li><strong>Preferências de sessão:</strong> armazena informações temporárias durante sua navegação.</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-semibold text-foreground">Armazenamento Local (Local Storage)</p>
              <p className="text-muted-foreground text-sm">
                Utilizamos o armazenamento local do navegador para manter sua sessão de autenticação e preferências de interface. Estes dados permanecem no seu dispositivo e são necessários para o funcionamento do serviço.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">3. Cookies de Terceiros</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma pode utilizar serviços de terceiros que colocam seus próprios cookies, como provedores de hospedagem e serviços de infraestrutura. Esses cookies estão sujeitos às políticas de privacidade dos respectivos terceiros.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">4. Como Gerenciar Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            Você pode configurar seu navegador para recusar cookies ou ser notificado quando um cookie for enviado. No entanto, a desativação de cookies essenciais pode impedir o uso adequado da plataforma, especialmente funcionalidades de login e compra.
          </p>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Instruções para gerenciar cookies nos principais navegadores:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
            <li><strong>Google Chrome:</strong> Configurações → Privacidade e Segurança → Cookies</li>
            <li><strong>Firefox:</strong> Configurações → Privacidade e Segurança → Cookies e Dados de Sites</li>
            <li><strong>Safari:</strong> Preferências → Privacidade → Cookies e Dados de Sites</li>
            <li><strong>Edge:</strong> Configurações → Cookies e Permissões de Site</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">5. Base Legal</h2>
          <p className="text-muted-foreground leading-relaxed">
            O uso de cookies essenciais se baseia no legítimo interesse da MAC CHIP em garantir o funcionamento seguro da plataforma (Art. 7º, IX da LGPD). Para cookies não essenciais, solicitaremos seu consentimento prévio quando aplicável.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">6. Alterações nesta Política</h2>
          <p className="text-muted-foreground leading-relaxed">
            Esta Política de Cookies poderá ser atualizada periodicamente. Recomendamos que você a revise regularmente para se manter informado sobre como utilizamos cookies.
          </p>
        </section>

        <div className="pt-6 border-t flex flex-wrap gap-4 text-sm">
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/termos")}>
            Termos de Uso
          </Button>
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/privacidade")}>
            Política de Privacidade
          </Button>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MAC CHIP — Todos os direitos reservados
      </footer>
    </div>
  );
};

export default Cookies;
