import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "../../hono";
import { db } from "~/server/db";
import { UnsendApiError } from "../../api-error";
import { deleteDomain as deleteDomainService } from "~/server/service/domain-service";

const route = createRoute({
  method: "delete",
  path: "/v1/domains/{id}",
  request: {
    params: z.object({
      id: z.coerce.number().openapi({
        param: {
          name: "id",
          in: "path",
        },
        example: 1,
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            id: z.number(),
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: "Domínio excluído com sucesso",
    },
    403: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Proibido - a chave de API não tem acesso",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Domínio não encontrado",
    },
  },
});

function deleteDomain(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const domainId = c.req.valid("param").id;

    // Enforce API key domain restriction
    if (team.apiKey.domainId && team.apiKey.domainId !== domainId) {
      throw new UnsendApiError({
        code: "FORBIDDEN",
        message: "A API key não tem acesso a este domínio",
      });
    }

    const domain = await db.domain.findFirst({
      where: {
        id: domainId,
        teamId: team.id,
      },
    });

    if (!domain) {
      throw new UnsendApiError({
        code: "NOT_FOUND",
        message: "Domínio não encontrado",
      });
    }

    const deletedDomain = await deleteDomainService(domainId);

    return c.json({
      id: deletedDomain.id,
      success: true,
      message: "Domain deleted successfully",
    });
  });
}

export default deleteDomain;
