import { CampaignStatus, DomainStatus, Prisma } from "@prisma/client";

import { db } from "../db";

export const ONBOARDING_STEPS = [
  "DOMAIN_CREATED",
  "DOMAIN_VERIFIED",
  "LIST_CREATED",
  "CONTACTS_ADDED",
  "CAMPAIGN_SENT",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Campanha que saiu do rascunho — agendada ja conta como "primeiro disparo". */
const DISPARADA: CampaignStatus[] = [
  CampaignStatus.SCHEDULED,
  CampaignStatus.RUNNING,
  CampaignStatus.PAUSED,
  CampaignStatus.SENT,
];

/** Snooze padrao do lembrete quando o usuario pede para nao ver mais. */
export const ONBOARDING_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
/** Intervalo minimo entre dois lembretes de "continuar de onde parou". */
export const ONBOARDING_REMINDER_INTERVAL_MS = 20 * 60 * 60 * 1000;

export type OnboardingState = {
  dismissedWelcomeAt?: string;
  snoozedUntil?: string;
  lastRemindedAt?: string;
};

function parseState(value: Prisma.JsonValue | null): OnboardingState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as OnboardingState;
}

/**
 * O progresso e SEMPRE derivado por contagem, nunca gravado. Assim o checklist
 * acompanha o usuario mesmo quando ele faz as coisas fora do wizard.
 */
export async function getOnboardingProgress(teamId: number) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { onboardingState: true, createdAt: true },
  });

  if (!team) {
    throw new Error("Team not found");
  }

  const [
    domainCount,
    verifiedDomainCount,
    listCount,
    contactCount,
    campaignCount,
  ] = await Promise.all([
    db.domain.count({ where: { teamId } }),
    db.domain.count({ where: { teamId, status: DomainStatus.SUCCESS } }),
    // Listas do "Rodar teste" nao contam: o usuario nao as criou.
    db.contactBook.count({ where: { teamId, isTest: false } }),
    db.contact.count({ where: { contactBook: { teamId, isTest: false } } }),
    db.campaign.count({ where: { teamId, status: { in: DISPARADA } } }),
  ]);

  const completed: Record<OnboardingStep, boolean> = {
    DOMAIN_CREATED: domainCount > 0,
    DOMAIN_VERIFIED: verifiedDomainCount > 0,
    LIST_CREATED: listCount > 0,
    CONTACTS_ADDED: contactCount > 0,
    CAMPAIGN_SENT: campaignCount > 0,
  };

  const completedCount = ONBOARDING_STEPS.filter(
    (step) => completed[step],
  ).length;

  const state = parseState(team.onboardingState);
  const now = Date.now();
  const snoozedUntil = state.snoozedUntil
    ? new Date(state.snoozedUntil)
    : null;

  const isComplete = completedCount === ONBOARDING_STEPS.length;

  // Primeiro passo ainda aberto — para onde o "Continuar" leva.
  const nextStep = ONBOARDING_STEPS.find((step) => !completed[step]) ?? null;

  const lastRemindedAt = state.lastRemindedAt
    ? new Date(state.lastRemindedAt)
    : null;

  return {
    steps: ONBOARDING_STEPS.map((step) => ({
      step,
      completed: completed[step],
    })),
    completedCount,
    totalCount: ONBOARDING_STEPS.length,
    isComplete,
    nextStep,
    /** Modal de boas-vindas: so uma vez, no primeiro acesso. */
    shouldShowWelcome: !isComplete && !state.dismissedWelcomeAt,
    /** Lembrete recorrente: no maximo 1 a cada 20h e respeitando o snooze. */
    shouldRemind:
      !isComplete &&
      Boolean(state.dismissedWelcomeAt) &&
      (!snoozedUntil || snoozedUntil.getTime() < now) &&
      (!lastRemindedAt ||
        now - lastRemindedAt.getTime() > ONBOARDING_REMINDER_INTERVAL_MS),
    isSnoozed: Boolean(snoozedUntil && snoozedUntil.getTime() > now),
  };
}

async function patchState(teamId: number, patch: OnboardingState) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { onboardingState: true },
  });

  const next = { ...parseState(team?.onboardingState ?? null), ...patch };

  await db.team.update({
    where: { id: teamId },
    data: { onboardingState: next as Prisma.InputJsonObject },
  });

  return next;
}

export function dismissWelcome(teamId: number) {
  return patchState(teamId, { dismissedWelcomeAt: new Date().toISOString() });
}

export function markReminded(teamId: number) {
  return patchState(teamId, { lastRemindedAt: new Date().toISOString() });
}

export function snoozeOnboarding(teamId: number) {
  return patchState(teamId, {
    snoozedUntil: new Date(Date.now() + ONBOARDING_SNOOZE_MS).toISOString(),
    lastRemindedAt: new Date().toISOString(),
  });
}
