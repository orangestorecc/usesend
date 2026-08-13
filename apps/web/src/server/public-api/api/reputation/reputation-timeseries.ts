import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { ReputationService } from "~/server/service/reputation-service";

const route = createRoute({
  method: "get",
  path: "/v1/reputation/timeseries",
  request: {
    query: z.object({
      days: z.string().optional().openapi({ description: "Janela em dias (padrao 30)" }),
      domainId: z.string().optional().openapi({ description: "Filtrar por dominio" }),
    }),
  },
  responses: {
    200: {
      description: "Serie diaria de entregas, retornos e taxa",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              date: z.string(),
              delivered: z.number().int(),
              hardBounced: z.number().int(),
              complained: z.number().int(),
              bounceRate: z.number(),
              complaintRate: z.number(),
            }),
          ),
        },
      },
    },
  },
});

export default function reputationTimeSeries(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const days = Number(c.req.query("days") ?? 30);
    const domainIdParam = c.req.query("domainId");
    const domainId =
      team.apiKey.domainId ?? (domainIdParam ? Number(domainIdParam) : undefined);

    const data = await ReputationService.getTimeSeries(team.id, {
      days: Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 30,
      domainId,
    });

    return c.json(data);
  });
}
