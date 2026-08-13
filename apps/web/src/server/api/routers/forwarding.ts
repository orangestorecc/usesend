import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import {
  criarRegra,
  definirStatus,
  listarEntregas,
  listarRegras,
  reenviarConfirmacao,
  removerRegra,
} from "~/server/service/forwarding-service";

export const forwardingRouter = createTRPCRouter({
  list: teamProcedure.query(({ ctx }) => listarRegras(ctx.team.id)),

  create: teamProcedure
    .input(
      z.object({
        domainId: z.number().int().positive().nullable(),
        destination: z.string().email("Digite um e-mail válido"),
      }),
    )
    .mutation(({ ctx, input }) =>
      criarRegra({
        teamId: ctx.team.id,
        userId: ctx.session.user.id,
        domainId: input.domainId,
        destination: input.destination,
      }),
    ),

  resendVerification: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => reenviarConfirmacao(ctx.team.id, input.id)),

  setStatus: teamProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(({ ctx, input }) =>
      definirStatus(ctx.team.id, input.id, input.active),
    ),

  delete: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => removerRegra(ctx.team.id, input.id)),

  deliveries: teamProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => listarEntregas(ctx.team.id, input.id)),
});
