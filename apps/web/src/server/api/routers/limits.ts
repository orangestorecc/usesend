import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { LimitService } from "~/server/service/limit-service";
import {
  LimitReason,
  PLAN_LIMITS,
  EXTRAS_CONFIG,
  ADDONS_CONFIG,
} from "~/lib/constants/plans";
import { db } from "~/server/db";
import { getThisMonthUsage } from "~/server/service/usage-service";
import type { EmailUsageType } from "@prisma/client";

export const limitsRouter = createTRPCRouter({
  // Visão consolidada de uso x limites (página de Uso estilo Resend).
  usageOverview: teamProcedure.query(async ({ ctx }) => {
    const team = ctx.team;
    const plan = team.isActive ? team.plan : "FREE";
    const limits = PLAN_LIMITS[plan];

    const usage = await getThisMonthUsage(team.id);
    const byType = (
      list: { type: EmailUsageType; sent: number }[],
      t: EmailUsageType,
    ) => list.find((x) => x.type === t)?.sent ?? 0;

    const [contacts, segments, broadcasts, domains] = await Promise.all([
      db.contact.count({ where: { contactBook: { teamId: team.id } } }),
      db.segment.count({ where: { teamId: team.id } }),
      db.campaign.count({ where: { teamId: team.id } }),
      db.domain.count({ where: { teamId: team.id } }),
    ]);

    return {
      plan,
      transactional: {
        monthly: {
          used: byType(usage.month, "TRANSACTIONAL"),
          limit: limits.emailsPerMonth,
        },
        daily: {
          used: byType(usage.day, "TRANSACTIONAL"),
          limit: plan === "FREE" ? limits.emailsPerDay : team.dailyEmailLimit,
        },
      },
      marketing: {
        contacts: { used: contacts, limit: limits.contacts },
        segments: { used: segments, limit: limits.segments },
        broadcasts: { used: broadcasts, limit: limits.broadcasts },
      },
      team: {
        aiCredits: { used: 0, limit: limits.aiCredits },
        automations: { used: 0, limit: limits.automations },
        domains: { used: domains, limit: limits.domains },
        rateLimit: team.apiRateLimit,
      },
      extras: EXTRAS_CONFIG,
      addons: {
        dedicatedIp: {
          available: limits.dedicatedIp,
          pricePerMonthBRL: ADDONS_CONFIG.dedicatedIp.pricePerMonthBRL,
        },
      },
    };
  }),

  /**
   * Consulta dedicada do limite de membros: o `get` genérico devolve uma
   * união de formatos, e a contagem atual não sobrevive a ela.
   */
  teamMembers: teamProcedure.query(async ({ ctx }) => {
    return LimitService.checkTeamMemberLimit(ctx.team.id);
  }),

  get: teamProcedure
    .input(
      z.object({
        type: z.nativeEnum(LimitReason),
      }),
    )
    .query(async ({ ctx, input }) => {
      switch (input.type) {
        case LimitReason.CONTACT_BOOK:
          return LimitService.checkContactBookLimit(ctx.team.id);
        case LimitReason.DOMAIN:
          return LimitService.checkDomainLimit(ctx.team.id);
        case LimitReason.TEAM_MEMBER:
          return LimitService.checkTeamMemberLimit(ctx.team.id);
        case LimitReason.WEBHOOK:
          return LimitService.checkWebhookLimit(ctx.team.id);
        default:
          // exhaustive guard
          throw new Error("Tipo de limite não suportado");
      }
    }),
});
