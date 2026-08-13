import { ReputationState } from "@prisma/client";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  teamProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { ReputationService } from "~/server/service/reputation-service";
import { registrarAuditoria } from "~/server/service/audit-service";

/** Motivo obrigatório em toda ação de admin — vira trilha de auditoria. */
const motivo = z.string().trim().min(10, "Descreva o motivo (mín. 10 caracteres)");

export const reputationRouter = createTRPCRouter({
  // ---------- Cliente ----------
  status: teamProcedure.query(async ({ ctx }) => {
    const status = await ReputationService.getStatus(ctx.team.id);
    return {
      state: status.state,
      bounceRate: status.snapshot.bounceRate,
      complaintRate: status.snapshot.complaintRate,
      sampleSize: status.snapshot.sampleSize,
      sampleSufficient: status.snapshot.sampleSufficient,
      windowDays: status.snapshot.windowDays,
      hardBounced: status.snapshot.hardBounced,
      delivered: status.snapshot.delivered,
      shortWindowBounceRate: status.snapshot.shortWindow.bounceRate,
      thresholds: {
        warning: status.policy.warningRate,
        critical: status.policy.criticalRate,
        block: status.policy.blockRate,
      },
      distanceToBlock: status.distanceToBlock,
      blockedAt: status.blockedAt,
      blockedReason: status.blockedReason,
      supervisedUntil: status.supervisedUntil,
      supervisedLimit: status.supervisedLimit,
    };
  }),

  timeSeries: teamProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(({ ctx, input }) =>
      ReputationService.getTimeSeries(ctx.team.id, { days: input.days }),
    ),

  breakdown: teamProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(({ ctx, input }) =>
      ReputationService.getBounceBreakdown(ctx.team.id, { days: input.days }),
    ),

  events: teamProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(20) }))
    .query(async ({ ctx, input }) => {
      const events = await ReputationService.getEvents(ctx.team.id, input.limit);
      return events.map((event) => ({
        ...event,
        bounceRate: Number(event.bounceRate.toString()),
        // O cliente ve "suporte", nunca qual admin agiu.
        actor: event.actor.startsWith("admin:") ? "suporte" : event.actor,
      }));
    }),

  /** Endereços que retornaram, para higienizar a lista. */
  recentBounces: teamProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const rows = await db.suppressionList.findMany({
        where: { teamId: ctx.team.id, reason: "HARD_BOUNCE" },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: { email: true, createdAt: true },
      });
      return rows;
    }),

  // ---------- Admin ----------
  adminPolicy: adminProcedure.query(async () => {
    const global = await db.reputationPolicy.findFirst({
      where: { teamId: null },
    });
    return global ?? null;
  }),

  adminUpdatePolicy: adminProcedure
    .input(
      z.object({
        windowDays: z.number().min(7).max(90),
        shortWindowSize: z.number().min(100).max(100000),
        minVolume: z.number().min(1),
        minBounces: z.number().min(1),
        warningRate: z.number().min(0).max(100),
        criticalRate: z.number().min(0).max(100),
        blockRate: z.number().min(0).max(100),
        unblockRate: z.number().min(0).max(100),
        minRecoveryVolume: z.number().min(0),
        autoBlock: z.boolean(),
        supervisedLimit: z.number().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.warningRate > input.criticalRate) {
        throw new Error("O limiar de alerta não pode ser maior que o de crítico");
      }
      if (input.criticalRate > input.blockRate) {
        throw new Error("O limiar crítico não pode ser maior que o de bloqueio");
      }
      if (input.unblockRate > input.blockRate) {
        throw new Error(
          "O limiar de desbloqueio precisa ser menor que o de bloqueio (histerese)",
        );
      }

      const existing = await db.reputationPolicy.findFirst({
        where: { teamId: null },
      });

      const policy = existing
        ? await db.reputationPolicy.update({
            where: { id: existing.id },
            data: input,
          })
        : await db.reputationPolicy.create({ data: { ...input, teamId: null } });

      await registrarAuditoria("reputation_policy_updated", {
        actorUserId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        metadata: input,
      });

      return policy;
    }),

  /**
   * Preview de impacto: quantos times entrariam em bloqueio com a régua
   * proposta. Nenhuma régua deve ser salva às cegas.
   */
  adminPolicyPreview: adminProcedure
    .input(
      z.object({
        blockRate: z.number().min(0).max(100),
        minVolume: z.number().min(1),
        minBounces: z.number().min(1),
      }),
    )
    .query(async ({ input }) => {
      const states = await db.teamReputationState.findMany({
        select: { teamId: true, bounceRate: true, sampleSize: true },
      });

      const affected = states.filter(
        (s) =>
          Number(s.bounceRate.toString()) >= input.blockRate &&
          s.sampleSize >= input.minVolume,
      );

      return {
        totalTeams: states.length,
        wouldBlock: affected.length,
        teamIds: affected.slice(0, 50).map((s) => s.teamId),
      };
    }),

  adminTeamsAtRisk: adminProcedure
    .input(
      z.object({
        state: z.nativeEnum(ReputationState).optional(),
        limit: z.number().min(1).max(200).default(50),
      }),
    )
    .query(async ({ input }) => {
      const rows = await db.teamReputationState.findMany({
        where: input.state ? { state: input.state } : {},
        orderBy: { bounceRate: "desc" },
        take: input.limit,
        include: { team: { select: { id: true, name: true, plan: true } } },
      });

      return rows.map((row) => ({
        teamId: row.teamId,
        teamName: row.team.name,
        plan: row.team.plan,
        state: row.state,
        bounceRate: Number(row.bounceRate.toString()),
        complaintRate: Number(row.complaintRate.toString()),
        sampleSize: row.sampleSize,
        blockedAt: row.blockedAt,
        lastEvaluatedAt: row.lastEvaluatedAt,
      }));
    }),

  adminTeamDetail: adminProcedure
    .input(z.object({ teamId: z.number() }))
    .query(async ({ ctx, input }) => {
      const [status, breakdown, events, series] = await Promise.all([
        ReputationService.getStatus(input.teamId),
        ReputationService.getBounceBreakdown(input.teamId),
        ReputationService.getEvents(input.teamId, 50),
        ReputationService.getTimeSeries(input.teamId),
      ]);

      // Ver o detalhe expõe dado de terceiro (endereços que quicaram): fica
      // registrado, como pede a LGPD.
      await registrarAuditoria("reputation_team_viewed", {
        actorUserId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetSubject: `team:${input.teamId}`,
        metadata: { teamId: input.teamId },
      });

      return {
        status: {
          ...status,
          snapshot: status.snapshot,
        },
        breakdown,
        series,
        events: events.map((e) => ({
          ...e,
          bounceRate: Number(e.bounceRate.toString()),
        })),
      };
    }),

  adminBlock: adminProcedure
    .input(z.object({ teamId: z.number(), reason: motivo }))
    .mutation(async ({ ctx, input }) => {
      const state = await ReputationService.adminBlock(
        input.teamId,
        ctx.session.user.id,
        input.reason,
      );
      await registrarAuditoria("reputation_team_blocked", {
        actorUserId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetSubject: `team:${input.teamId}`,
        metadata: { teamId: input.teamId, motivo: input.reason },
      });
      return { state };
    }),

  adminUnblock: adminProcedure
    .input(z.object({ teamId: z.number(), reason: motivo }))
    .mutation(async ({ ctx, input }) => {
      const state = await ReputationService.adminUnblock(
        input.teamId,
        ctx.session.user.id,
        input.reason,
      );
      await registrarAuditoria("reputation_team_unblocked", {
        actorUserId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetSubject: `team:${input.teamId}`,
        metadata: { teamId: input.teamId, motivo: input.reason },
      });
      return { state };
    }),

  adminSupervise: adminProcedure
    .input(
      z.object({
        teamId: z.number(),
        reason: motivo,
        dailyLimit: z.number().min(1).max(1000000).optional(),
        days: z.number().min(1).max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const state = await ReputationService.adminSupervise(
        input.teamId,
        ctx.session.user.id,
        input.reason,
        { dailyLimit: input.dailyLimit, days: input.days },
      );
      await registrarAuditoria("reputation_team_supervised", {
        actorUserId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetSubject: `team:${input.teamId}`,
        metadata: {
          teamId: input.teamId,
          motivo: input.reason,
          limiteDiario: input.dailyLimit ?? null,
          dias: input.days ?? null,
        },
      });
      return { state };
    }),

  adminExempt: adminProcedure
    .input(
      z.object({
        teamId: z.number(),
        reason: motivo,
        days: z.number().min(1).max(365).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const state = await ReputationService.adminExempt(
        input.teamId,
        ctx.session.user.id,
        input.reason,
        input.days,
      );
      await registrarAuditoria("reputation_team_exempted", {
        actorUserId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetSubject: `team:${input.teamId}`,
        metadata: {
          teamId: input.teamId,
          motivo: input.reason,
          dias: input.days ?? null,
        },
      });
      return { state };
    }),
});
