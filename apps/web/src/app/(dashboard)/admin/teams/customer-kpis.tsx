"use client";

import { Skeleton } from "@usesend/ui/src/skeleton";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "~/server/api/root";

type Kpis = inferRouterOutputs<AppRouter>["admin"]["listCustomers"]["kpis"];

const nf = new Intl.NumberFormat("pt-BR");

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pct = (n: number) =>
  `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

/**
 * Régua de indicadores da lista de clientes.
 *
 * Mesma gramática visual da régua do dashboard (rótulo micro em versalete,
 * número grande em mono): dois blocos de KPI na mesma aplicação não podem
 * parecer vindos de produtos diferentes. A nota abaixo do número carrega o
 * contexto — assim o valor principal nunca precisa virar uma frase.
 */
export function CustomerKpis({
  kpis,
  isLoading,
}: {
  kpis?: Kpis;
  isLoading: boolean;
}) {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-[18px]"
          >
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="mt-4 h-8 w-24 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Clientes",
      dot: "bg-muted-foreground",
      value: nf.format(kpis.totalCustomers),
      note: "contas cadastradas",
    },
    {
      label: "Free",
      dot: "bg-muted-foreground/40",
      value: nf.format(kpis.freeCustomers),
      note:
        kpis.totalCustomers > 0
          ? `${pct((kpis.freeCustomers / kpis.totalCustomers) * 100)} da base`
          : "—",
    },
    {
      label: "Pagos",
      dot: "bg-success",
      value: nf.format(kpis.paidCustomers),
      note:
        kpis.overdueCustomers > 0
          ? `${nf.format(kpis.overdueCustomers)} em atraso`
          : "todos em dia",
    },
    {
      label: "Conversão",
      dot: "bg-success",
      value: kpis.totalCustomers ? pct(kpis.conversionRate) : "—",
      note: "pagos ÷ total",
    },
    {
      label: "MRR",
      dot: "bg-success",
      value: brl(kpis.mrrCents),
      note:
        kpis.mrrAtRiskCents > 0
          ? `${brl(kpis.mrrAtRiskCents)} em risco`
          : `ARPU ${brl(kpis.arpuCents)}`,
    },
  ];

  // Retenção fica numa segunda linha, menor: são números de leitura, não de
  // operação diária — competindo por espaço com o MRR, atrapalhariam os dois.
  const retencao = [
    {
      label: "Churn 30d",
      value: kpis.churnedLast30 === 0 ? "—" : pct(kpis.churnRate),
      note: `${nf.format(kpis.churnedLast30)} cancelamento(s)`,
    },
    {
      label: "LTV",
      value: kpis.ltvCents === null ? "—" : brl(kpis.ltvCents),
      note: kpis.ltvCents === null ? "sem churn para estimar" : "ARPU ÷ churn",
    },
    {
      label: "Inadimplentes",
      value: nf.format(kpis.overdueCustomers),
      note: `${brl(kpis.mrrAtRiskCents)} parados`,
    },
  ];

  return (
    <div className="space-y-3">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-border bg-card p-[18px]"
        >
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
            {c.label}
          </div>
          <div className="mt-3 truncate font-mono text-3xl font-semibold tracking-tight">
            {c.value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{c.note}</div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-3 gap-4">
      {retencao.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-border bg-card/50 px-4 py-3"
        >
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {c.label}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold tracking-tight">
              {c.value}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {c.note}
            </span>
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}
