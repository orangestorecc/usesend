import { db } from "~/server/db";
import type { Product } from "~/server/billing/payment-service";
import { FREE_PLAN_KEY } from "~/server/billing/plan-service";

/**
 * Indicadores financeiros da lista de clientes (admin).
 *
 * Regra de ouro daqui: nenhuma consulta por cliente. Tudo é resolvido em
 * quatro consultas agregadas sobre o conjunto de times exibido, senão a lista
 * vira N+1 assim que o Madmail passar de algumas dezenas de contas.
 */

/** Situação de pagamento exibida na coluna de status da tabela. */
export type BillingStatus =
  /** Plano gratuito — cobrança não se aplica. */
  | "free"
  /** Assinatura ativa, dentro do período e sem fatura vencida. */
  | "em_dia"
  /** past_due, período expirado ou fatura em aberto vencida. */
  | "atrasado"
  /** Atraso passou das 24h e o envio foi pausado pelo job. */
  | "travado"
  /** Time marcado como pago mas sem assinatura ativa (estado inconsistente). */
  | "sem_assinatura";

export type CustomerFinancials = {
  teamId: number;
  /** Chave do plano contratado (pro, scale, pro_marketing…), se pago. */
  planKey: string | null;
  /** Nome do plano para exibição ("Pro", "Scale"). */
  planName: string | null;
  /** Soma de tudo que o cliente já pagou, em centavos (lifetime). */
  totalPaidCents: number;
  /** Preço mensal contratado, em centavos — mesmo se o cliente está atrasado. */
  monthlyPriceCents: number;
  /** Receita recorrente mensal reconhecida (zero se não está em dia). */
  mrrCents: number;
  billingStatus: BillingStatus;
  /** Fim do período vigente — "em dia até". */
  currentPeriodEnd: Date | null;
  /** Quantidade de faturas em aberto já vencidas. */
  overdueInvoices: number;
  /** Quando o envio foi pausado por inadimplência, se foi. */
  billingBlockedAt: Date | null;
};

/**
 * O plano vem do time (planKey), não mais do priceId da assinatura: depois da
 * unificação é o campo do time que manda, e ele continua certo mesmo quando a
 * assinatura foi cancelada.
 */
type TeamLite = {
  id: number;
  plan: "FREE" | "BASIC";
  planKey: string;
  planProduct: string;
  billingBlockedAt?: Date | null;
};

const PAID_SUB_STATUSES = ["active", "past_due"];

/**
 * Tabela de preços inteira em memória, uma consulta só.
 *
 * É ela que dá nome e preço de tabela a cada plano — inclusive planos criados
 * direto na tela de Planos, que não existem no catálogo do código.
 */
async function carregarCatalogo() {
  const rows = await db.planCatalogEntry.findMany({
    select: { product: true, key: true, name: true, priceBRL: true },
  });
  return new Map(
    rows.map((r) => [`${r.product}:${r.key}`, r]),
  );
}

type Catalogo = Awaited<ReturnType<typeof carregarCatalogo>>;

/**
 * Preço mensal cobrado de fato: a última cobrança paga do plano vigente já
 * reflete cupom e faixa de volume. A tabela de preços é o plano B — usá-la
 * como fonte primária inflaria o MRR de todo cliente com desconto.
 */
function monthlyPriceCents(
  catalogo: Catalogo,
  product: Product,
  planKey: string | null,
  lastPaidForPlan: number | null,
): number {
  if (lastPaidForPlan !== null) return lastPaidForPlan;
  if (!planKey) return 0;
  const row = catalogo.get(`${product}:${planKey}`);
  return row?.priceBRL != null ? row.priceBRL * 100 : 0;
}

/**
 * Resolve os dados financeiros de um conjunto de times de uma vez só.
 */
export async function loadCustomerFinancials(
  teams: TeamLite[],
  now = new Date(),
): Promise<Map<number, CustomerFinancials>> {
  const teamIds = teams.map((t) => t.id);
  const result = new Map<number, CustomerFinancials>();
  if (teamIds.length === 0) return result;

  const [catalogo, subs, paidTotals, lastPaidCharges, overdue] = await Promise.all([
    carregarCatalogo(),
    db.subscription.findMany({
      where: { teamId: { in: teamIds }, status: { in: PAID_SUB_STATUSES } },
      orderBy: { createdAt: "desc" },
      select: {
        teamId: true,
        status: true,
        priceId: true,
        currentPeriodEnd: true,
      },
    }),
    db.charge.groupBy({
      by: ["teamId"],
      where: { teamId: { in: teamIds }, status: "paid" },
      _sum: { amountCents: true },
    }),
    db.charge.findMany({
      // `paidAt: not null` importa: no Postgres, DESC coloca NULL primeiro, e
      // uma cobrança sem data de pagamento seria eleita a "mais recente".
      where: { teamId: { in: teamIds }, status: "paid", paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      distinct: ["teamId"],
      select: { teamId: true, amountCents: true, planKey: true },
    }),
    db.invoice.groupBy({
      by: ["teamId"],
      where: {
        teamId: { in: teamIds },
        status: "open",
        dueAt: { lt: now },
      },
      _count: { _all: true },
    }),
  ]);

  // findMany já veio ordenado por createdAt desc: o primeiro de cada time é o
  // mais recente, então só o primeiro entra no mapa.
  const subByTeam = new Map<number, (typeof subs)[number]>();
  for (const sub of subs) {
    if (!subByTeam.has(sub.teamId)) subByTeam.set(sub.teamId, sub);
  }
  const paidByTeam = new Map(
    paidTotals.map((row) => [row.teamId, row._sum.amountCents ?? 0]),
  );
  const lastChargeByTeam = new Map(
    lastPaidCharges.map((row) => [row.teamId, row]),
  );
  const overdueByTeam = new Map(
    overdue.map((row) => [row.teamId, row._count._all]),
  );

  for (const team of teams) {
    const sub = subByTeam.get(team.id);
    const planKey = team.planKey === FREE_PLAN_KEY ? null : team.planKey;
    const product = (
      team.planProduct === "marketing" ? "marketing" : "transactional"
    ) as Product;
    const overdueInvoices = overdueByTeam.get(team.id) ?? 0;
    const periodEnd = sub?.currentPeriodEnd ?? null;

    let billingStatus: BillingStatus;
    if (!planKey) {
      billingStatus = "free";
    } else if (team.billingBlockedAt) {
      billingStatus = "travado";
    } else if (!sub) {
      billingStatus = "sem_assinatura";
    } else if (
      sub.status === "past_due" ||
      overdueInvoices > 0 ||
      (periodEnd !== null && periodEnd.getTime() < now.getTime())
    ) {
      billingStatus = "atrasado";
    } else {
      billingStatus = "em_dia";
    }

    const lastCharge = lastChargeByTeam.get(team.id);
    // Só reaproveita a última cobrança se ela for do plano vigente — senão um
    // upgrade recente sairia precificado pelo plano antigo.
    const lastPaidForPlan =
      lastCharge && planKey && lastCharge.planKey === planKey
        ? lastCharge.amountCents
        : null;

    const priceCents = monthlyPriceCents(
      catalogo,
      product,
      planKey,
      lastPaidForPlan,
    );

    result.set(team.id, {
      teamId: team.id,
      planKey,
      planName: planKey
        ? (catalogo.get(`${product}:${planKey}`)?.name ?? planLabel(planKey))
        : null,
      totalPaidCents: paidByTeam.get(team.id) ?? 0,
      monthlyPriceCents: priceCents,
      // MRR conta só receita que está de fato entrando. Inadimplente vira
      // "MRR em risco" no bloco de indicadores, não MRR.
      mrrCents: billingStatus === "em_dia" ? priceCents : 0,
      billingStatus,
      currentPeriodEnd: periodEnd,
      overdueInvoices,
      billingBlockedAt: team.billingBlockedAt ?? null,
    });
  }

  return result;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  scale: "Scale",
  enterprise: "Enterprise",
  pro_marketing: "Pro marketing",
};

export function planLabel(planKey: string) {
  return PLAN_LABELS[planKey] ?? planKey;
}

export type CustomerKpis = {
  totalCustomers: number;
  freeCustomers: number;
  paidCustomers: number;
  /** Percentual 0-100 de clientes pagantes sobre o total. */
  conversionRate: number;
  mrrCents: number;
  /** MRR de pagantes inadimplentes — não entra no MRR, mas dá o tamanho do risco. */
  mrrAtRiskCents: number;
  /** Receita média por cliente pagante em dia, em centavos. */
  arpuCents: number;
  overdueCustomers: number;
  /** Cancelamentos nos últimos 30 dias. */
  churnedLast30: number;
  /** Churn mensal em % — cancelados ÷ (pagantes de hoje + cancelados). */
  churnRate: number;
  /** ARPU ÷ churn mensal, em centavos. null quando ninguém cancelou ainda. */
  ltvCents: number | null;
};

/** Cancelamentos da janela usada no churn. */
export async function contarCancelamentos(dias = 30, now = new Date()) {
  const desde = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000);
  return db.subscription.count({
    where: { canceledAt: { gte: desde, lte: now } },
  });
}

/**
 * KPIs do topo. Recebe os mesmos times já carregados pela lista para que os
 * números do bloco e da tabela nunca divirjam.
 */
export function buildCustomerKpis(
  teams: TeamLite[],
  financials: Map<number, CustomerFinancials>,
  /** Cancelamentos dos últimos 30 dias, de contarCancelamentos. */
  churnedLast30 = 0,
): CustomerKpis {
  const totalCustomers = teams.length;
  const freeCustomers = teams.filter((t) => t.planKey === FREE_PLAN_KEY).length;
  const paidCustomers = totalCustomers - freeCustomers;

  let mrrCents = 0;
  let mrrAtRiskCents = 0;
  let overdueCustomers = 0;
  let payingOnTime = 0;

  for (const team of teams) {
    const fin = financials.get(team.id);
    if (!fin) continue;
    mrrCents += fin.mrrCents;
    if (fin.mrrCents > 0) payingOnTime += 1;
    if (fin.billingStatus !== "free" && fin.billingStatus !== "em_dia") {
      overdueCustomers += 1;
      mrrAtRiskCents += fin.monthlyPriceCents;
    }
  }

  // Base do churn = quem estava pagando no início da janela, aproximada por
  // "pagantes de hoje + quem cancelou no período". Sem um histórico diário de
  // assinantes é a melhor estimativa honesta — e ela não infla o churn quando
  // a base cresce.
  const baseChurn = paidCustomers + churnedLast30;
  const churnRate = baseChurn === 0 ? 0 : (churnedLast30 / baseChurn) * 100;
  const arpu = payingOnTime === 0 ? 0 : Math.round(mrrCents / payingOnTime);

  return {
    totalCustomers,
    freeCustomers,
    paidCustomers,
    conversionRate:
      totalCustomers === 0 ? 0 : (paidCustomers / totalCustomers) * 100,
    mrrCents,
    mrrAtRiskCents,
    arpuCents: arpu,
    overdueCustomers,
    churnedLast30,
    churnRate,
    // LTV = ticket médio dividido pela taxa de saída. Sem cancelamento não há
    // divisor, e um LTV "infinito" seria pior que não mostrar nada.
    ltvCents: churnRate === 0 ? null : Math.round(arpu / (churnRate / 100)),
  };
}
