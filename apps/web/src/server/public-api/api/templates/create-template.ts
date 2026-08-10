import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { UnsendApiError } from "~/server/public-api/api-error";
import { db } from "~/server/db";
import { EmailRenderer } from "@usesend/email-editor/src/renderer";

const bodySchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  content: z
    .string()
    .optional()
    .describe("Editor JSON (TipTap). Renderizado para html no servidor."),
  html: z.string().optional().describe("HTML pronto, alternativa a content."),
});

const route = createRoute({
  method: "post",
  path: "/v1/templates",
  request: {
    body: { content: { "application/json": { schema: bodySchema } } },
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
      description: "Create a template",
    },
  },
});

export default function createTemplate(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const body = c.req.valid("json");

    let html: string | null = body.html ?? null;
    if (body.content) {
      try {
        const renderer = new EmailRenderer(JSON.parse(body.content));
        html = await renderer.render();
      } catch (e) {
        throw new UnsendApiError({
          code: "BAD_REQUEST",
          message: "JSON de conteúdo inválido para renderização do template",
        });
      }
    }

    const template = await db.template.create({
      data: {
        name: body.name,
        subject: body.subject,
        content: body.content ?? null,
        html,
        teamId: team.id,
      },
    });

    return c.json({
      id: template.id,
      name: template.name,
      subject: template.subject,
      html: template.html,
      content: template.content,
    });
  });
}
