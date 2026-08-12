import type { Metadata } from "next";
import { SiteFooter } from "~/components/SiteFooter";
import { TopNav } from "~/components/TopNav";
import { Button } from "@usesend/ui/src/button";

// Links de produto — confirmar domínios finais com o time.
const APP_URL = "https://app.madmail.com.br";
const SIGNUP_URL = `${APP_URL}/cadastro`;
const SITE_URL = "https://www.madmail.com.br";

export const metadata: Metadata = {
  title: "Sobre o Madmail — e-mail marketing na era da IA",
  description:
    "O Madmail é um produto da N49: e-mail marketing feito para o varejo na era da IA. Aberto, sem trava de fornecedor e pensado para você disparar conversando.",
  alternates: { canonical: `${SITE_URL}/sobre` },
};

export default function SobrePage() {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <TopNav />
      <Hero />
      <Missao />
      <Principios />
      <CtaFinal />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section>
      <div className="mx-auto max-w-3xl px-6 pb-8 pt-16 text-center sm:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Um produto da N49
        </div>
        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          E-mail marketing na era da IA
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-muted-foreground sm:text-lg">
          O Madmail nasceu de uma pergunta simples: e se montar uma campanha
          fosse tão rápido quanto pedir para alguém? Em vez de mais um painel
          para aprender, você dispara{" "}
          <span className="text-foreground">conversando</span>.
        </p>
      </div>
    </section>
  );
}

function Missao() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-sm uppercase tracking-wider text-muted-foreground">
          Nossa missão
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Colocar o e-mail marketing na velocidade do varejo
        </h2>
        <div className="mt-6 space-y-4 text-muted-foreground">
          <p>
            Quem vende no varejo não tem tempo de virar especialista em
            ferramenta de e-mail. A oferta é hoje, a lista muda toda semana e a
            concorrência dispara sem parar. O trabalho de segmentar planilha,
            escrever, testar e agendar sempre foi um gargalo.
          </p>
          <p>
            O Madmail tira esse gargalo. Conectando seu assistente de IA —
            ChatGPT, Claude ou qualquer um via MCP — à nossa infraestrutura de
            envio, a campanha vira conversa. A IA sugere o segmento e a cópia,
            você aprova e o disparo acontece de verdade, com a performance
            voltando em tempo real.
          </p>
          <p>
            Feito para o varejo que já usa IA no dia a dia e quer velocidade, não
            complexidade.
          </p>
        </div>
      </div>
    </section>
  );
}

function Principios() {
  const cards = [
    {
      title: "Do seu jeito, sem amarras",
      body: "SMTP padrão, API, conector de IA (MCP) ou envio manual pelo painel. Seus dados e seus contatos são seus, para exportar quando quiser.",
    },
    {
      title: "Sem trava, sem letra miúda",
      body: "Comece de graça, cancele quando quiser. Preço em reais e transparente, sem surpresa no fim do mês.",
    },
    {
      title: "Feito por quem dispara",
      body: "Somos a N49. Já cuidamos do e-mail de varejistas de verdade — o Madmail é a ferramenta que a gente queria ter.",
    },
  ];
  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-sm uppercase tracking-wider text-muted-foreground">
          No que a gente acredita
        </div>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
          Simples, aberto e do lado de quem envia
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

function CtaFinal() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Venha disparar conversando
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Crie sua conta em minutos e faça a primeira campanha falando com o seu
          assistente.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="px-6">
            <a href={SIGNUP_URL}>Criar sua conta</a>
          </Button>
          <Button size="lg" variant="outline" className="px-6">
            <a href="/ai">Ver como funciona</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
