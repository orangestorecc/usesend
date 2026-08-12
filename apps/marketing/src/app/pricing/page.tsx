import type { Metadata } from "next";
import { SiteFooter } from "~/components/SiteFooter";
import { TopNav } from "~/components/TopNav";
import { Button } from "@usesend/ui/src/button";
import { PricingPlans } from "~/components/PricingPlans";

// Links de produto — confirmar domínios finais com o time.
const APP_URL = "https://app.madmail.com.br";
const SIGNUP_URL = `${APP_URL}/cadastro`;
const SITE_URL = "https://www.madmail.com.br";

export const metadata: Metadata = {
  title: "Preços do Madmail — planos em R$ para o varejo",
  description:
    "Comece de graça e pague só quando o volume crescer. Planos Free, Pro, Scale e Enterprise em reais, com nota fiscal e sem fidelidade.",
  alternates: { canonical: `${SITE_URL}/pricing` },
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <TopNav />
      <PricingPlans />
      <Faq />
      <SiteFooter />
    </main>
  );
}


/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function Faq() {
  const qas = [
    {
      q: "Como funciona a cobrança?",
      a: "Os planos são mensais, em reais e com nota fiscal. Você escolhe o volume no seletor acima e paga aquele valor fixo — sem tarifa por e-mail e sem gasto mínimo.",
    },
    {
      q: "O que acontece se eu passar do limite de e-mails?",
      a: "Nada de bloqueio surpresa. O excedente é cobrado por mil e-mails, com tarifa que cai conforme o plano cresce — de R$ 4,50 por mil no Pro até R$ 2,30 no Scale de maior volume. Se virou rotina, subir de plano sai mais barato.",
    },
    {
      q: "Posso usar quantos domínios?",
      a: "Um no Free, dez no Pro e mil no Scale. No Enterprise, quantos a sua operação precisar.",
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
