"use client";

import * as React from "react";
import { Button } from "@usesend/ui/src/button";

import { AwsSesLinha } from "~/components/AwsSesBadge";

import {
  estadoDoCard,
  PASSOS_MARKETING,
  PASSOS_TRANSACIONAL,
} from "@usesend/lib/src/pricing";

/**
 * Planos do site.
 *
 * Usa a mesma matriz de preços do app (`@usesend/lib/src/pricing`) de
 * propósito: se o site e o checkout tivessem cada um a sua tabela, um dia
 * anunciaríamos um preço e cobraríamos outro. É o tipo de divergência que só
 * aparece com o cliente reclamando.
 */

// SVG inline em vez de lucide-react: o site não tem essa dependência e não
// vale adicioná-la por dois ícones.
function IconeOk({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M4 10.5 8 14.5 16 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeNao({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M5 5 15 15M15 5 5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Produto = "transactional" | "marketing";

type Feature = { label: string; ok: boolean };

type Card = {
  key: string;
  nome: string;
  precoFixo: number | null;
  volumeFixo: string;
  extraFixo?: string;
  cta: string;
  features: Feature[];
};

const APP_URL = "https://app.madmail.com.br";
const SIGNUP_URL = `${APP_URL}/cadastro`;

const CARDS_TRANSACIONAL: Card[] = [
  {
    key: "free",
    nome: "Free",
    precoFixo: 0,
    volumeFixo: "3.000 e-mails / mês",
    cta: "Começar de graça",
    features: [
      { label: "Envio e recebimento", ok: true },
      { label: "Suporte por ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "Retenção de dados por 30 dias", ok: true },
      { label: "1 domínio", ok: true },
      { label: "5 créditos de IA / mês", ok: true },
      { label: "100 e-mails por dia", ok: false },
      { label: "IPs dedicados", ok: false },
    ],
  },
  {
    key: "pro",
    nome: "Pro",
    precoFixo: 100,
    volumeFixo: "50.000 e-mails / mês",
    cta: "Assinar Pro",
    features: [
      { label: "Envio e recebimento", ok: true },
      { label: "Suporte por ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "Retenção de dados por 30 dias", ok: true },
      { label: "10 domínios", ok: true },
      { label: "100 créditos de IA / mês", ok: true },
      { label: "Sem limite diário", ok: true },
      { label: "IPs dedicados", ok: false },
    ],
  },
  {
    key: "scale",
    nome: "Scale",
    precoFixo: 450,
    volumeFixo: "100.000 e-mails / mês",
    cta: "Assinar Scale",
    features: [
      { label: "Envio e recebimento", ok: true },
      { label: "Suporte via Slack e ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "Retenção de dados por 30 dias", ok: true },
      { label: "1.000 domínios", ok: true },
      { label: "500 créditos de IA / mês", ok: true },
      { label: "Sem limite diário", ok: true },
      { label: "IP dedicado como add-on", ok: true },
    ],
  },
  {
    key: "enterprise",
    nome: "Enterprise",
    precoFixo: null,
    volumeFixo: "Um plano sob medida para a sua operação",
    cta: "Fale conosco",
    features: [
      { label: "Envio e recebimento", ok: true },
      { label: "Suporte prioritário", ok: true },
      { label: "Execuções flexíveis", ok: true },
      { label: "Retenção flexível", ok: true },
      { label: "Domínios flexíveis", ok: true },
      { label: "Créditos de IA flexíveis", ok: true },
      { label: "Sem limite diário", ok: true },
      { label: "IPs dedicados como add-on", ok: true },
    ],
  },
];

const CARDS_MARKETING: Card[] = [
  {
    key: "free",
    nome: "Free",
    precoFixo: 0,
    volumeFixo: "1.000 contatos",
    extraFixo: "Envio de campanhas ilimitado",
    cta: "Começar de graça",
    features: [
      { label: "Suporte por ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "3 segmentos", ok: true },
      { label: "1 domínio", ok: true },
      { label: "5 créditos de IA / mês", ok: true },
      { label: "Análises de marketing", ok: false },
      { label: "IPs dedicados", ok: false },
    ],
  },
  {
    key: "pro_marketing",
    nome: "Pro marketing",
    precoFixo: 200,
    volumeFixo: "5.000 contatos",
    extraFixo: "Envio de campanhas ilimitado",
    cta: "Assinar Pro marketing",
    features: [
      { label: "Suporte via Slack e ticket", ok: true },
      { label: "10.000 execuções de automação", ok: true },
      { label: "Segmentos ilimitados", ok: true },
      { label: "Domínios ilimitados", ok: true },
      { label: "100 créditos de IA / mês", ok: true },
      { label: "Análises de marketing", ok: true },
      { label: "IP dedicado como add-on", ok: false },
    ],
  },
  {
    key: "enterprise",
    nome: "Enterprise",
    precoFixo: null,
    volumeFixo: "Um plano sob medida para a sua operação",
    extraFixo: "Envio de campanhas ilimitado",
    cta: "Fale conosco",
    features: [
      { label: "Suporte prioritário", ok: true },
      { label: "Segmentos ilimitados", ok: true },
      { label: "Domínios ilimitados", ok: true },
      { label: "Créditos de IA flexíveis", ok: true },
      { label: "Análises de marketing", ok: true },
      { label: "IPs dedicados inclusos", ok: true },
    ],
  },
];

export function PricingPlans({
  comoSecao = false,
  ancora,
}: {
  /** Na home o titulo e h2: o h1 da pagina ja e o do hero. */
  comoSecao?: boolean;
  ancora?: string;
} = {}) {
  const [produto, setProduto] = React.useState<Produto>("transactional");
  const [passo, setPasso] = React.useState(0);

  const passos =
    produto === "transactional" ? PASSOS_TRANSACIONAL : PASSOS_MARKETING;
  const cards =
    produto === "transactional" ? CARDS_TRANSACIONAL : CARDS_MARKETING;

  function trocarProduto(novo: Produto) {
    setProduto(novo);
    setPasso(0);
  }

  return (
    <section
      id={ancora}
      className={`mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 ${
        comoSecao ? "border-t border-border" : ""
      }`}
    >
      <div className="text-center">
        {comoSecao ? (
          <>
            <div className="text-sm uppercase tracking-wider text-muted-foreground">
              Preços
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Preços em real, sem surpresa no câmbio
            </h2>
          </>
        ) : (
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Preços em real, sem surpresa no câmbio
          </h1>
        )}
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Comece de graça e pague só quando o volume crescer. Arraste para ver o
          plano que atende o seu envio.
        </p>
      </div>

      {/* Alternador de produto */}
      <div className="mt-8 flex justify-center">
        <div className="inline-flex rounded-full bg-muted p-1">
          <button
            type="button"
            onClick={() => trocarProduto("transactional")}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              produto === "transactional"
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            E-mails transacionais
          </button>
          <button
            type="button"
            onClick={() => trocarProduto("marketing")}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              produto === "marketing"
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            E-mails de marketing
          </button>
        </div>
      </div>

      {/* Slider de volume */}
      <div className="mx-auto mt-8 w-full max-w-3xl px-2">
        <input
          type="range"
          min={0}
          max={passos.length - 1}
          value={passo}
          onChange={(e) => setPasso(Number(e.target.value))}
          className="w-full accent-foreground"
          aria-label={
            produto === "transactional"
              ? "E-mails por mês"
              : "Número de contatos"
          }
          aria-valuetext={passos[passo]}
        />
        <div
          className="mt-2 grid text-center"
          style={{ gridTemplateColumns: `repeat(${passos.length}, 1fr)` }}
        >
          {passos.map((p, i) => (
            <span
              key={p}
              className={`text-[11px] ${
                i === passo
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {p}
            </span>
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {produto === "transactional"
            ? `Até ${passos[passo]} e-mails por mês`
            : `Até ${passos[passo]} contatos`}
        </p>
      </div>

      {/* Cards */}
      <div
        className={`mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 ${
          cards.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        {cards.map((card) => {
          const estado = estadoDoCard(
            produto,
            card.key,
            passo,
            card.precoFixo,
            card.volumeFixo,
          );
          const personalizado = estado.precoBRL === null;

          return (
            <div
              key={card.key}
              className={`flex flex-col rounded-2xl border p-6 transition-opacity ${
                estado.recomendado
                  ? "border-foreground/40 bg-muted/30 shadow-lg"
                  : ""
              } ${estado.esmaecido ? "opacity-40" : ""}`}
            >
              <div className="text-center text-sm font-medium text-muted-foreground">
                {card.nome}
              </div>

              {estado.recomendado ? (
                <div className="mt-2 text-center">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                    Recomendado
                  </span>
                </div>
              ) : null}

              <div className="py-5 text-center">
                <span className="text-4xl font-semibold tracking-tight">
                  {personalizado
                    ? "Personalizado"
                    : `R$ ${estado.precoBRL!.toLocaleString("pt-BR")}`}
                </span>
                {!personalizado ? (
                  <span className="text-sm text-muted-foreground"> / mês</span>
                ) : null}
              </div>

              <div className="min-h-[64px] border-y py-4 text-center">
                <p className="text-sm font-medium">{estado.volume}</p>
                {estado.extra ?? card.extraFixo ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {estado.extra ?? card.extraFixo}
                  </p>
                ) : null}
              </div>

              <ul className="flex-1 space-y-3 py-6">
                {card.features.map((f) => (
                  <li
                    key={f.label}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    {f.ok ? (
                      <IconeOk className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <IconeNao className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className={f.ok ? "" : "text-muted-foreground"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="w-full"
                variant={estado.recomendado ? "default" : "outline"}
              >
                <a
                  href={
                    personalizado
                      ? "mailto:contato@madmail.com.br"
                      : SIGNUP_URL
                  }
                >
                  {card.cta}
                </a>
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Preços em reais, com nota fiscal. Sem fidelidade — cancele quando
        quiser.
      </p>
      <AwsSesLinha />
    </section>
  );
}
