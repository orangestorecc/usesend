import { z } from "zod";

import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import {
  addMcpKey,
  listMcpKeys,
  deleteMcpKey,
  type McpScopes,
} from "~/server/service/mcp-key-service";

const scopeLevel = z.enum(["none", "read", "write"]);

const scopesSchema = z.object({
  contacts: scopeLevel,
  lists: scopeLevel,
  templates: scopeLevel,
  segments: scopeLevel,
  campaigns: scopeLevel,
  analytics: z.enum(["none", "read"]),
  // Entregabilidade é só leitura por decisão de projeto (ver McpScopes).
  reputation: z.enum(["none", "read"]).default("none"),
  send: z.boolean(),
});

export const mcpRouter = createTRPCRouter({
  createMcpKey: teamProcedure
    .input(z.object({ name: z.string().min(1), scopes: scopesSchema }))
    .mutation(async ({ ctx, input }) => {
      return await addMcpKey({
        name: input.name,
        teamId: ctx.team.id,
        scopes: input.scopes as McpScopes,
      });
    }),

  getMcpKeys: teamProcedure.query(async ({ ctx }) => {
    return listMcpKeys(ctx.team.id);
  }),

  deleteMcpKey: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return deleteMcpKey(input.id, ctx.team.id);
    }),
});
