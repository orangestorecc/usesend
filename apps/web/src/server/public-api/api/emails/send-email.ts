import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { sendEmail } from "~/server/service/email-service";
import { emailSchema } from "../../schemas/email-schema";
import { IdempotencyService } from "~/server/service/idempotency-service";

const route = createRoute({
  method: "post",
  path: "/v1/emails",
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
          schema: emailSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ emailId: z.string().optional() }),
        },
      },
      description: "Recupera o usuário",
    },
  },
});

function send(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const requestBody = c.req.valid("json");

    let html: string | undefined;
    const rawHtml = requestBody?.html?.toString();
    if (rawHtml && rawHtml !== "true" && rawHtml !== "false") {
      html = rawHtml;
    }

    const clientPayload = {
      ...requestBody,
      text: requestBody.text ?? undefined,
      html,
    };

    const idemKey = c.req.header("Idempotency-Key") ?? undefined;

    const result = await IdempotencyService.withIdempotency<
      typeof clientPayload,
      { emailId?: string }
    >({
      teamId: team.id,
      idemKey,
      payload: clientPayload,
      operation: async () => {
        const email = await sendEmail({
          ...clientPayload,
          teamId: team.id,
          apiKeyId: team.apiKeyId,
        });
        return { emailId: email?.id };
      },
      extractEmailIds: (result) => (result.emailId ? [result.emailId] : []),
      formatCachedResponse: (emailIds) => ({ emailId: emailIds[0] }),
      logContext: "email send",
    });

    return c.json(result);
  });
}

export default send;
