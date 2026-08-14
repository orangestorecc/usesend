import { Plan } from "@prisma/client";

export enum LimitReason {
  DOMAIN = "DOMAIN",
  CONTACT_BOOK = "CONTACT_BOOK",
  TEAM_MEMBER = "TEAM_MEMBER",
  WEBHOOK = "WEBHOOK",
  EMAIL_BLOCKED = "EMAIL_BLOCKED",
  /** Envio pausado por taxa de retorno acima do limite. Ver docs-spec/BOUNCE-CONTROL-SPEC.md */
  EMAIL_BOUNCE_BLOCKED = "EMAIL_BOUNCE_BLOCKED",
  /** Envio pausado 24h apos o vencimento de uma fatura. */
  EMAIL_BILLING_BLOCKED = "EMAIL_BILLING_BLOCKED",
  EMAIL_DAILY_LIMIT_REACHED = "EMAIL_DAILY_LIMIT_REACHED",
  EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED = "EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED",
}

/** Texto exibido ao usuário quando um limite do plano bloqueia a ação. */
export const LIMIT_REASON_MESSAGES: Record<LimitReason, string> = {
  [LimitReason.DOMAIN]:
    "Você atingiu o limite de domínios do seu plano. Faça upgrade para adicionar mais.",
  [LimitReason.CONTACT_BOOK]:
    "Você atingiu o limite de listas de contatos do seu plano. Faça upgrade ou use uma lista existente.",
  [LimitReason.TEAM_MEMBER]:
    "Você atingiu o limite de membros do time no seu plano. Faça upgrade para convidar mais pessoas.",
  [LimitReason.WEBHOOK]:
    "Você atingiu o limite de webhooks do seu plano. Faça upgrade para criar mais.",
  [LimitReason.EMAIL_BLOCKED]: "Os envios deste time estão bloqueados.",
  [LimitReason.EMAIL_BOUNCE_BLOCKED]:
    "Os envios estão pausados por taxa de retorno acima do limite.",
  [LimitReason.EMAIL_BILLING_BLOCKED]:
    "Os envios estão pausados por uma fatura em aberto. Pague a fatura em Configurações > Faturamento para voltar a enviar.",
  [LimitReason.EMAIL_DAILY_LIMIT_REACHED]:
    "Você atingiu o limite diário de e-mails do seu plano.",
  [LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED]:
    "Você atingiu o limite mensal de e-mails do plano gratuito.",
};

// -1 = ilimitado. Campos "projetados" (contacts/segments/broadcasts/aiCredits/
// automations) alimentam a página de Uso estilo Resend; alguns
// ainda não são aplicados/rastreados (IA, automações) — projeção para a UI.
export type PlanLimits = {
  emailsPerMonth: number;
  emailsPerDay: number;
  domains: number;
  contactBooks: number;
  teamMembers: number;
  webhooks: number;
  contacts: number;
  segments: number;
  broadcasts: number;
  aiCredits: number;
  automations: number;
  rateLimit: number; // req/s (default; Team.apiRateLimit pode sobrescrever)
};

// O add-on de IP dedicado NÃO mora aqui. Este mapa é indexado pelo enum
// `Plan` (FREE/BASIC), que não separa Pro de Scale — uma flag por aqui daria
// o add-on ao Pro, que no /pricing diz "IPs dedicados: não". A elegibilidade
// é `planoTemIpDedicado(planKey)`, em @usesend/lib/src/pricing.

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    emailsPerMonth: 3000,
    emailsPerDay: 100,
    domains: 1,
    contactBooks: 1,
    teamMembers: 1,
    webhooks: 1,
    contacts: 1000,
    segments: 3,
    broadcasts: -1,
    aiCredits: 5,
    automations: 10000,
    rateLimit: 2,
  },
  BASIC: {
    emailsPerMonth: -1,
    emailsPerDay: -1,
    domains: -1,
    contactBooks: -1,
    teamMembers: -1,
    webhooks: -1,
    contacts: -1,
    segments: -1,
    broadcasts: -1,
    aiCredits: 100,
    automations: 10000,
    rateLimit: 10,
  },
};

// Extras (pay-as-you-go) e add-ons agora moram em `@usesend/lib/src/pricing`
// (EXTRAS / ADDONS), junto da tabela de preços. Ficavam aqui com R$ 0,90 por
// mil e-mails enquanto o /pricing anunciava R$ 4,50 no mesmo plano: dois
// preços para a mesma coisa, e o cliente lendo o outro.
