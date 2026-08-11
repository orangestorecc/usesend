import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { db } from "~/server/db";

const route = createRoute({
  method: "get",
  path: "/v1/templates",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              subject: z.string(),
              createdAt: z.string(),
              updatedAt: z.string(),
            }),
          ),
        },
      },
      description: "Lista os templates do time",
    },
  },
});

export default function getTemplates(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const templates = await db.template.findMany({
      where: { teamId: team.id },
      select: {
        id: true,
        name: true,
        subject: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return c.json(
      templates.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    );
  });
}
