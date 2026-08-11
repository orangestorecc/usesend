import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { sendBulkEmails } from "~/server/service/email-service";
import { EmailContent } from "~/types";
import { emailSchema } from "../../schemas/email-schema";
import { IdempotencyService } from "~/server/service/idempotency-service";

// Define the schema for a single email within the bulk request
// This is similar to the schema in send-email.ts but without the top-level 'required'
// Removed inline emailSchema definition

const route = createRoute({
  method: "post",
  path: "/v1/emails/batch",
  request: {
    headers: z
      .object({
        "Idempotency-Key": z
          .string()
          .min(1)
          .max(256)
          .optional()
          .openapi({
            description: `Envie o cabeçalho opcional Idempotency-Key para tornar a requisição segura para novas tentativas. A chave pode ter até 256 caracteres. O servidor armazena o corpo canônico da requisição e se comporta da seguinte forma:

- Mesma chave + mesmo corpo de requisição → retorna o emailId original com 200 OK, sem reenviar.
- Mesma chave + corpo de requisição diferente → retorna 409 Conflict com code: NOT_UNIQUE para que você possa detectar a divergência.
- Mesma chave enquanto outra requisição ainda está sendo processada → retorna 409 Conflict; tente novamente após um curto intervalo ou quando a primeira requisição terminar.

Os registros expiram após 24 horas. Use uma chave única por envio lógico (por exemplo, um ID de pedido ou de cadastro).`,
          }),
      })
      .partial(),
    body: {
      required: true,
      content: {
        "application/json": {
          // Use the imported schema in an array
          schema: z.array(emailSchema).max(100, {
            message:
              "Cannot send more than 100 emails in a single bulk request",
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          // Return an array of objects with the created email IDs
          schema: z.object({
            data: z.array(z.object({ emailId: z.string() })),
          }),
        },
      },
      description: "Lista de IDs de e-mails criados com sucesso",
    },
    // Add other potential error responses based on sendBulkEmails logic if needed
  },
});

function sendBatch(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const emailPayloads = c.req.valid("json");

    const normalizedPayloads = emailPayloads.map((payload) => ({
      ...payload,
      text: payload.text ?? undefined,
      html:
        payload.html && payload.html !== "true" && payload.html !== "false"
          ? payload.html
          : undefined,
    }));

    const idemKey = c.req.header("Idempotency-Key") ?? undefined;

    const responseData = await IdempotencyService.withIdempotency({
      teamId: team.id,
      idemKey,
      payload: normalizedPayloads,
      operation: async () => {
        const emailsToSend: Array<
          EmailContent & { teamId: number; apiKeyId?: number }
        > = normalizedPayloads.map((payload) => ({
          ...payload,
          teamId: team.id,
          apiKeyId: team.apiKeyId,
        }));

        const createdEmails = await sendBulkEmails(emailsToSend);

        return createdEmails.map((email) => ({
          emailId: email.id,
        }));
      },
      extractEmailIds: (data) => data.map((item) => item.emailId),
      formatCachedResponse: (emailIds) =>
        emailIds.map((id) => ({ emailId: id })),
      logContext: "bulk email send",
    });

    return c.json({ data: responseData });
  });
}

export default sendBatch;
