import type { Metadata } from "next";
import { SiteFooter } from "~/components/SiteFooter";
import { TopNav } from "~/components/TopNav";
import { Button } from "@usesend/ui/src/button";
import { PricingCalculator } from "~/components/PricingCalculator";

// Links de produto — confirmar domínios finais com o time.
const APP_URL = "https://app.madmail.com.br";
const SIGNUP_URL = `${APP_URL}/cadastro`;
const SITE_URL = "https://www.madmail.com.br";

export const metadata: Metadata = {
  title: "Preços do Madmail — planos em R$ para o varejo",
  description:
    "Comece de graça e cresça quando o disparo crescer. Planos Free, Pro e Scale em reais, calculadora de custo por e-mail e respostas sobre cobrança, domínios e cancelamento.",
  alternates: { canonical: `${SITE_URL}/pricing` },
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <TopNav />
      <Planos />
      <Calculadora />
      <Faq />
      <SiteFooter />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Planos                                                              */
/* ------------------------------------------------------------------ */

function Planos() {
  const planos = [
    {
      nome: "Free",
      preco: "R$ 0",
      nota: "para sempre",
      destaque: false,
      perks: [
        "3.000 e-mails por mês",
        "100 e-mails por dia",
        "1 domínio",
        "1 lista de contatos",
        "Retenção de dados de 1 dia",
      ],
      cta: "Começar grátis",
    },
    {
      nome: "Pro",
      preco: "R$ 100",
      nota: "por mês",
      destaque: true,
      perks: [
        "50.000 e-mails por mês",
        "Domínios ilimitados",
        "Retenção de dados de 3 dias",
        "Editor + automações",
        "Conector de IA (MCP)",
      ],
      cta: "Assinar o Pro",
    },
    {
      nome: "Scale",
      preco: "R$ 450",
      nota: "por mês",
      destaque: false,
      perks: [
        "100.000 e-mails por mês",
        "Retenção de dados de 7 dias",
        "IPs dedicados sob demanda",
        "Suporte prioritário",
        "Membros ilimitados",
      ],
      cta: "Assinar o Scale",
    },
  ];

  return (
    <section className="pt-16 sm:pt-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-sm uppercase tracking-wider text-muted-foreground">
            Preços
          </div>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Simples como o resto
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Comece de graça. Cresça quando o disparo crescer. Sem surpresa no
            fim do mês, sem cartão para começar.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {planos.map((p) => (
            <div
              key={p.nome}
              className={`flex flex-col rounded-2xl border p-6 ${
                p.destaque
                  ? "border-primary/60 bg-primary/[0.04]"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{p.nome}</h2>
                {p.destaque ? (
                  <span className="rounded-full border border-primary/50 px-2 py-0.5 text-[11px] text-primary">
                    Mais popular
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-tight">
                  {p.preco}
                </span>
                <span className="mb-1 text-xs text-muted-foreground">
                  {p.nota}
                </span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check /> <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-2">
                <Button
                  className="w-full"
                  variant={p.destaque ? "default" : "outline"}
                >
                  <a href={SIGNUP_URL}>{p.cta}</a>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Precisa de mais volume?{" "}
          <a
            href="mailto:contato@madmail.com.br"
            className="text-foreground underline underline-offset-4"
          >
            Fale com a gente
          </a>{" "}
          sobre o plano Enterprise.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Calculadora                                                         */
/* ------------------------------------------------------------------ */

function Calculadora() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Faça a conta do seu volume
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Você paga só o que envia. Arraste os controles e veja a estimativa.
          </p>
        </div>
        <div className="mt-10">
          <PricingCalculator />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function Faq() {
  const qas = [
    {
      q: "Como funciona a cobrança?",
      a: "Os planos são mensais e em reais. Além do plano, você paga por e-mail enviado conforme o volume — marketing e transacional têm tarifas diferentes, com um gasto mínimo mensal. Use a calculadora acima para estimar.",
    },
    {
      q: "O que acontece se eu passar do limite de e-mails?",
      a: "Nada de bloqueio surpresa. O excedente é cobrado pela tarifa por e-mail do seu plano. Se o volume ficou grande demais, a gente sugere subir de plano para sair mais barato.",
    },
    {
      q: "Posso usar quantos domínios?",
      a: "No Free você conecta 1 domínio. Nos planos Pro e Scale os domínios são ilimitados — conecte todas as suas marcas e lojas.",
    },
    {
      q: "O conector de IA está incluso?",
      a: "O conector MCP para ChatGPT e Claude está incluso a partir do plano Pro, sem custo extra por assistente conectado.",
    },
    {
      q: "Preciso de cartão para começar?",
      a: "Não. O plano Free é para sempre e não pede cartão. Você só informa a forma de pagamento quando decide assinar Pro ou Scale.",
    },
    {
      q: "Como cancelo?",
      a: "Quando quiser, direto no painel. Sem multa e sem fidelidade. Você continua com acesso até o fim do ciclo já pago e seus dados podem ser exportados.",
    },
  ];
  return (
    <section className="border-t border-border py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <div className="text-sm uppercase tracking-wider text-muted-foreground">
            Dúvidas
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Perguntas frequentes
          </h2>
        </div>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border">
          {qas.map((item) => (
            <div key={item.q} className="p-6">
              <h3 className="font-medium">{item.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Ainda com dúvida?{" "}
          <a
            href="mailto:contato@madmail.com.br"
            className="text-foreground underline underline-offset-4"
          >
            Fale com a gente
          </a>
          .
        </p>
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
