import { z } from "zod";
import { Prisma } from "@prisma/client";

import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

const PAGE_SIZE = 30;

export const apiLogRouter = createTRPCRouter({
  list: teamProcedure
    .input(
      z.object({
        days: z.number().optional(),
        status: z.enum(["all", "success", "error"]).optional(),
        statusCode: z.number().optional(),
        source: z.string().optional(), // agente: mcp | go | curl | http
        apiKeyName: z.string().optional(), // source (nome da API key)
        search: z.string().optional(),
        page: z.number().default(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.ApiRequestLogWhereInput = { teamId: ctx.team.id };

      if (input.days) {
        where.createdAt = {
          gte: new Date(Date.now() - input.days * 86400000),
        };
      }
      if (input.statusCode) {
        where.statusCode = input.statusCode;
      } else if (input.status === "success") {
        where.statusCode = { gte: 200, lt: 300 };
      } else if (input.status === "error") {
        where.statusCode = { gte: 400 };
      }
      if (input.source) where.source = input.source;
      if (input.apiKeyName) where.apiKeyName = input.apiKeyName;
      if (input.search) {
        where.endpoint = { contains: input.search, mode: "insensitive" };
      }

      const page = input.page ?? 1;
      const [logs, total] = await Promise.all([
        db.apiRequestLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: PAGE_SIZE,
          skip: (page - 1) * PAGE_SIZE,
        }),
        db.apiRequestLog.count({ where }),
      ]);

      return {
        logs,
        totalPage: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      };
    }),

  // Nomes de API key que já apareceram nos logs (para o filtro "sources").
  sources: teamProcedure.query(async ({ ctx }) => {
    const rows = await db.apiRequestLog.findMany({
      where: { teamId: ctx.team.id, apiKeyName: { not: null } },
      distinct: ["apiKeyName"],
      select: { apiKeyName: true },
      take: 100,
    });
    return rows.map((r) => r.apiKeyName).filter((n): n is string => Boolean(n));
  }),
});
