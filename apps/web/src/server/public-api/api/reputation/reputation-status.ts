import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { ReputationService } from "~/server/service/reputation-service";

const route = createRoute({
  method: "get",
  path: "/v1/reputation/status",
  responses: {
    200: {
      description:
        "Estado de entregabilidade do time: taxa de retorno da janela, limiares aplicados e distancia do bloqueio",
      content: {
        "application/json": {
          schema: z.object({
            state: z.enum([
              "HEALTHY",
              "WARNING",
              "CRITICAL",
              "BLOCKED",
              "SUPERVISED",
              "EXEMPT",
            ]),
            bounceRate: z.number(),
            complaintRate: z.number(),
            sampleSize: z.number().int(),
            sampleSufficient: z.boolean(),
            windowDays: z.number().int(),
            shortWindowBounceRate: z.number(),
            thresholds: z.object({
              warning: z.number(),
              critical: z.number(),
              block: z.number(),
              unblock: z.number(),
            }),
            distanceToBlock: z.number(),
            blockedAt: z.string().nullable(),
            blockedReason: z.string().nullable(),
            supervisedUntil: z.string().nullable(),
            supervisedDailyLimit: z.number().int().nullable(),
          }),
        },
      },
    },
  },
});

export default function reputationStatus(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const status = await ReputationService.getStatus(team.id);

    return c.json({
      state: status.state,
      bounceRate: status.snapshot.bounceRate,
      complaintRate: status.snapshot.complaintRate,
      sampleSize: status.snapshot.sampleSize,
      sampleSufficient: status.snapshot.sampleSufficient,
      windowDays: status.snapshot.windowDays,
      shortWindowBounceRate: status.snapshot.shortWindow.bounceRate,
      thresholds: {
        warning: status.policy.warningRate,
        critical: status.policy.criticalRate,
        block: status.policy.blockRate,
        unblock: status.policy.unblockRate,
      },
      distanceToBlock: status.distanceToBlock,
      blockedAt: status.blockedAt?.toISOString() ?? null,
      blockedReason: status.blockedReason,
      supervisedUntil: status.supervisedUntil?.toISOString() ?? null,
      supervisedDailyLimit: status.supervisedLimit,
    });
  });
}
