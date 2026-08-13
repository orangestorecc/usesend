import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { ReputationService } from "~/server/service/reputation-service";

const entry = z.object({
  key: z.string(),
  count: z.number().int(),
  share: z.number(),
});

const route = createRoute({
  method: "get",
  path: "/v1/reputation/bounce-breakdown",
  request: {
    query: z.object({
      days: z.string().optional().openapi({ description: "Janela em dias (padrao 30)" }),
      limit: z.string().optional().openapi({ description: "Top N (padrao 10)" }),
    }),
  },
  responses: {
    200: {
      description: "Dominios e motivos que mais geram retorno definitivo",
      content: {
        "application/json": {
          schema: z.object({
            days: z.number().int(),
            totalHardBounces: z.number().int(),
            byDomain: z.array(entry),
            byReason: z.array(entry),
          }),
        },
      },
    },
  },
});

export default function reputationBreakdown(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const days = Number(c.req.query("days") ?? 30);
    const limit = Number(c.req.query("limit") ?? 10);

    const data = await ReputationService.getBounceBreakdown(team.id, {
      days: Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 30,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 10,
    });

    return c.json(data);
  });
}
