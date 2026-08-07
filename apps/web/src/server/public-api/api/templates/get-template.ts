import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { UnsendApiError } from "~/server/public-api/api-error";
import { db } from "~/server/db";

const route = createRoute({
  method: "get",
  path: "/v1/templates/{templateId}",
  request: {
    params: z.object({ templateId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            name: z.string(),
            subject: z.string(),
            html: z.string().nullable(),
            content: z.string().nullable(),
          }),
        },
      },
      description: "Get a template by id",
    },
  },
});

export default function getTemplate(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const { templateId } = c.req.valid("param");
    const template = await db.template.findUnique({
      where: { id: templateId, teamId: team.id },
    });
    if (!template) {
      throw new UnsendApiError({
        code: "NOT_FOUND",
        message: "Template not found",
      });
    }
    return c.json({
      id: template.id,
      name: template.name,
      subject: template.subject,
      html: template.html,
      content: template.content,
    });
  });
}
