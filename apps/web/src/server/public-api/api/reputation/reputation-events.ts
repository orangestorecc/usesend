import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { ReputationService } from "~/server/service/reputation-service";

const route = createRoute({
  method: "get",
  path: "/v1/reputation/events",
  request: {
    query: z.object({
      limit: z.string().optional().openapi({ description: "Padrao 50, maximo 200" }),
    }),
  },
  responses: {
    200: {
      description: "Historico de mudancas de estado de entregabilidade do time",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              id: z.string(),
              fromState: z.string(),
              toState: z.string(),
              bounceRate: z.number(),
              sampleSize: z.number().int(),
              actor: z.string(),
              reason: z.string().nullable(),
              createdAt: z.string(),
            }),
          ),
        },
      },
    },
  },
});

export default function reputationEvents(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const limitParam = Number(c.req.query("limit") ?? 50);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 50;

    const events = await ReputationService.getEvents(team.id, limit);

    return c.json(
      events.map((event) => ({
        id: event.id,
        fromState: event.fromState,
        toState: event.toState,
        bounceRate: Number(event.bounceRate.toString()),
        sampleSize: event.sampleSize,
        // Nunca vaza qual admin agiu — para o cliente e sempre "suporte".
        actor: event.actor.startsWith("admin:") ? "suporte" : event.actor,
        reason: event.reason,
        createdAt: event.createdAt.toISOString(),
      })),
    );
  });
}
