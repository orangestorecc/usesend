import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { UnsendApiError } from "~/server/public-api/api-error";
import { EmailRenderer } from "@usesend/email-editor/src/renderer";

const bodySchema = z.object({
  content: z.string().describe("Editor JSON (TipTap) a renderizar."),
  previewText: z.string().optional(),
});

const route = createRoute({
  method: "post",
  path: "/v1/templates/render",
  request: {
    body: { content: { "application/json": { schema: bodySchema } } },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ html: z.string() }),
        },
      },
      description: "Render editor JSON to HTML (sem salvar)",
    },
  },
});

export default function renderTemplate(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const body = c.req.valid("json");
    try {
      const renderer = new EmailRenderer(JSON.parse(body.content));
      const html = await renderer.render();
      return c.json({ html });
    } catch (e) {
      throw new UnsendApiError({
        code: "BAD_REQUEST",
        message: "Invalid content JSON for rendering",
      });
    }
  });
}
