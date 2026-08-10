import type { Metadata } from "next";
import { SiteFooter } from "~/components/SiteFooter";
import { TopNav } from "~/components/TopNav";
import { Button } from "@usesend/ui/src/button";

// Links de produto — confirmar domínios finais com o time.
const APP_URL = "https://app.madmail.com.br";
const SIGNUP_URL = `${APP_URL}/cadastro`;
const DOCS_URL = "https://docs.madmail.com.br";
const SITE_URL = "https://www.madmail.com.br";

export const metadata: Metadata = {
  title: "Madmail no ChatGPT e Claude — campanhas por conversa",
  description:
    "Crie campanhas de e-mail marketing falando com o ChatGPT ou o Claude. O conector MCP do Madmail segmenta, escreve, agenda e dispara de verdade. Feito para o varejo.",
  alternates: { canonical: `${SITE_URL}/ai` },
};

export default function AiPage() {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <TopNav />
      <Hero />
      <ComoFunciona />
      <Conector />
      <Passos />
      <Execucao />
      <CtaFinal />
      <SiteFooter />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 pb-8 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            O jeito Madmail
          </div>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Sua campanha começa numa conversa
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Conecte o Madmail ao ChatGPT ou ao Claude e{" "}
            <span className="text-foreground">peça a campanha falando</span>. A
            IA segmenta a lista, escreve o e-mail e agenda o disparo. Você
            aprova. O Madmail envia de verdade e devolve a performance.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="px-6">
              <a href={SIGNUP_URL}>Criar sua conta</a>
            </Button>
            <Button size="lg" variant="outline" className="px-6">
              <a href="/ai#mcp">Conectar meu assistente</a>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <ChatMock />
        </div>
      </div>
    </section>
  );
}

function ChatMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[#0A0A0A]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="ml-2 font-mono text-xs text-neutral-500">
          madmail · assistente
        </span>
      </div>
      <div className="space-y-4 p-5 font-mono text-sm leading-relaxed">
        <p className="text-neutral-400">
          <span className="mr-2 text-neutral-100">&gt;</span>
          quero avisar quem comprou tênis no último mês sobre a nova coleção
        </p>
        <p className="text-neutral-100">
          <span className="mr-2 text-neutral-500">&lt;</span>
          Separei <span className="text-white">3.190 contatos</span> que
          compraram calçados nos últimos 30 dias. Escrevi um assunto e um corpo
          com a coleção nova. Quer revisar antes de agendar?
        </p>
        <p className="text-neutral-400">
          <span className="mr-2 text-neutral-100">&gt;</span>
          mostra o assunto
        </p>
        <p className="text-neutral-100">
          <span className="mr-2 text-neutral-500">&lt;</span>
          &quot;Chegou a coleção que combina com o seu último par&quot;. Aprova
          ou quero outro?
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Como funciona                                                       */
/* ------------------------------------------------------------------ */

function ComoFunciona() {
  const cards = [
    {
      title: "Fale como você já fala",
      body: "Sem painel novo, sem treinamento. Você descreve a campanha em linguagem natural, do jeito que pediria para um estagiário.",
    },
    {
      title: "A IA faz o trabalho pesado",
      body: "Segmentação, cópia do assunto, corpo do e-mail e melhor horário. Tudo sugerido em segundos, pronto para você ajustar.",
    },
    {
      title: "Você mantém o controle",
      body: "Nada é enviado sem a sua confirmação. Reveja, edite e só então libere o disparo real.",
    },
  ];
  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-sm uppercase tracking-wider text-muted-foreground">
          Como funciona
        </div>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
          Criar campanha virou conversa, não planilha
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="rounded-xl border border-border p-6">
              <h3 className="font-medium">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Conector MCP                                                         */
/* ------------------------------------------------------------------ */

function Conector() {
  return (
    <section id="mcp" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="text-sm uppercase tracking-wider text-muted-foreground">
              Conector MCP
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Um plugue entre seu assistente e o Madmail
            </h2>
            <p className="mt-4 text-muted-foreground">
              MCP (Model Context Protocol) é o padrão aberto que deixa o ChatGPT,
              o Claude e outros assistentes usarem ferramentas externas. O
              Madmail expõe suas ações — segmentar, escrever, agendar, disparar,
              ler métricas — como ferramentas que a IA chama por você.
            </p>

            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Funciona com ChatGPT, Claude e qualquer cliente compatível com MCP",
                "Autenticação por chave própria — só a sua conta, só os seus dados",
                "A IA propõe a ação; o disparo real só acontece com aprovação",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Check /> <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex gap-3">
              <Button>
                <a href="/ai#mcp">Como conectar</a>
              </Button>
              <Button variant="outline">
                <a href={DOCS_URL}>Ver a documentação</a>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 font-mono text-sm leading-relaxed">
            <p className="text-neutral-500"># conecte o Madmail ao seu assistente</p>
            <p className="mt-3 text-neutral-100">
              <span className="mr-2 text-neutral-500">servidor</span>
              mcp.madmail.com.br
            </p>
            <p className="mt-1 text-neutral-100">
              <span className="mr-2 text-neutral-500">chave</span>
              mk_live_••••••••••••
            </p>
            <p className="mt-4 text-neutral-400">
              ferramentas disponíveis:
            </p>
            <p className="mt-2 text-neutral-100">segmentar_contatos</p>
            <p className="text-neutral-100">redigir_campanha</p>
            <p className="text-neutral-100">agendar_disparo</p>
            <p className="text-neutral-100">ler_metricas</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Passo a passo                                                       */
/* ------------------------------------------------------------------ */

function Passos() {
  const passos = [
    {
      n: "01",
      title: "Conecte seu assistente",
      body: "Cole a chave do Madmail no ChatGPT ou no Claude. Leva um minuto e vale para sempre.",
    },
    {
      n: "02",
      title: "Peça a campanha",
      body: "Descreva o público e a oferta. A IA monta a lista e escreve o e-mail na hora.",
    },
    {
      n: "03",
      title: "Aprove",
      body: "Reveja assunto, corpo e segmento. Ajuste com uma frase ou libere como está.",
    },
    {
      n: "04",
      title: "Dispare",
      body: "O Madmail envia de verdade pela infraestrutura própria e devolve a performance.",
    },
  ];
  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-sm uppercase tracking-wider text-muted-foreground">
          Passo a passo
        </div>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
          Da ideia ao disparo em quatro passos
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {passos.map((p) => (
            <div key={p.n} className="rounded-xl border border-border p-6">
              <div className="font-mono text-sm text-muted-foreground">
                {p.n}
              </div>
              <h3 className="mt-3 font-medium">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Execução real                                                       */
/* ------------------------------------------------------------------ */

function Execucao() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="text-sm uppercase tracking-wider text-muted-foreground">
              Não é brinquedo
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Disparo real, com infraestrutura de gente grande
            </h2>
            <p className="mt-4 text-muted-foreground">
              Quando você aprova, o e-mail sai de verdade pela infraestrutura de
              envio do Madmail — com SPF, DKIM e DMARC configurados, supressão
              automática de quedas e reclamações, e métricas que voltam para a
              conversa em tempo real.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Entrega cuidada para chegar na caixa de entrada, não no spam",
                "Aberturas, cliques, quedas e descadastros de volta no chat",
                "Mesma infraestrutura que atende o varejo que já dispara com a N49",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Check /> <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 font-mono text-sm leading-relaxed">
            <p className="text-neutral-400">
              <span className="mr-2 text-neutral-100">&gt;</span>
              como foi a campanha de ontem?
            </p>
            <p className="mt-3 text-neutral-100">
              <span className="mr-2 text-neutral-500">&lt;</span>
              Enviados <span className="text-white">3.190</span> · abertura{" "}
              <span className="text-white">41%</span> · cliques{" "}
              <span className="text-white">9,2%</span>. Três quedas já foram
              suprimidas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* CTA final                                                           */
/* ------------------------------------------------------------------ */

function CtaFinal() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Faça a primeira campanha conversando
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Crie sua conta, conecte seu assistente e dispare hoje mesmo.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="px-6">
            <a href={SIGNUP_URL}>Criar sua conta</a>
          </Button>
          <Button size="lg" variant="outline" className="px-6">
            <a href="/pricing">Ver preços</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
