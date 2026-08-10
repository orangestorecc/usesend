import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  emailTimeSeries,
  reputationMetricsData,
} from "~/server/service/dashboard-service";

export const dashboardRouter = createTRPCRouter({
  emailTimeSeries: teamProcedure
    .input(
      z.object({
        days: z.number().optional(),
        domain: z.number().optional(),
        campaignId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { team } = ctx;
      return emailTimeSeries({
        team,
        days: input.days,
        domain: input.domain,
        campaignId: input.campaignId,
      });
    }),

  reputationMetricsData: teamProcedure
    .input(
      z.object({
        domain: z.number().optional(),
        campaignId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { team } = ctx;
      return reputationMetricsData({
        team,
        domain: input.domain,
        campaignId: input.campaignId,
      });
    }),

  // Lista leve de campanhas para o filtro (id + nome).
  campaignsForFilter: teamProcedure.query(async ({ ctx }) => {
    return db.campaign.findMany({
      where: { teamId: ctx.team.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }),
});
