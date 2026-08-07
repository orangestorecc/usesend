import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { DEFAULT_SCOPES } from "~/server/service/mcp-key-service";

const route = createRoute({
  method: "get",
  path: "/v1/mcp/me",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            teamId: z.number(),
            teamName: z.string(),
            scopes: z.any(),
          }),
        },
      },
      description: "Retorna time + escopos do token MCP apresentado",
    },
  },
});

export default function mcpMe(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    // Token MCP traz mcpScopes; se for uma API key normal, considera acesso total.
    const scopes = team.mcpScopes ?? DEFAULT_SCOPES;
    return c.json({ teamId: team.id, teamName: team.name, scopes });
  });
}
