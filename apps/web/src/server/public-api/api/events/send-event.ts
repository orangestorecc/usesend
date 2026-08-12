import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { UnsendApiError } from "~/server/public-api/api-error";
import { validateEventName } from "@usesend/lib/src/automations/automation-events";
import { AutomationEventService } from "~/server/service/automation-event-service";
import { resolveEventContact } from "~/server/service/automation-event-service";

const route = createRoute({
  method: "post",
  path: "/v1/events/send",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            name: z.string(),
            contactId: z.string().optional(),
            email: z.string().optional(),
            contactBookId: z.string().optional(),
            payload: z.record(z.any()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ contactId: z.string() }),
        },
      },
      description: "Evento registrado e automações correspondentes disparadas",
    },
  },
});

function sendEvent(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const body = c.req.valid("json");

    const validation = validateEventName(body.name);
    if (!validation.valid) {
      throw new UnsendApiError({
        code: "BAD_REQUEST",
        message: validation.error,
      });
    }

    if (!body.contactId && !body.email) {
      throw new UnsendApiError({
        code: "BAD_REQUEST",
        message: "contactId ou email é obrigatório",
      });
    }

    let contact;
    try {
      contact = await resolveEventContact({
        teamId: team.id,
        contactId: body.contactId,
        email: body.email,
        contactBookId: body.contactBookId,
      });
    } catch (error) {
      throw new UnsendApiError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "Contato inválido",
      });
    }

    await AutomationEventService.recordAndDispatch(team.id, {
      name: body.name,
      contact,
      payload: body.payload,
    });

    return c.json({ contactId: contact.id });
  });
}

export default sendEvent;
