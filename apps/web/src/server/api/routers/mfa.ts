import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  getCurrentSessionRow,
  lerSessionTokenDoCookie,
  sessaoElevada,
} from "~/server/auth-session";
import {
  ativarMfa,
  avaliarGate,
  criarDesafioDeMfa,
  desativarMfa,
  pedirCodigoDeAtivacao,
  usarRecoveryCode,
  verificarDesafio,
} from "~/server/service/mfa-service";

/**
 * Router do desafio de MFA. Usa `authedProcedure` de propósito: o
 * `protectedProcedure` roda o gate, e um gate que bloqueia a própria tela de
 * verificação tranca a pessoa para sempre.
 */
export const mfaRouter = createTRPCRouter({
  status: authedProcedure.query(async ({ ctx }) => {
    const gate = await avaliarGate(lerSessionTokenDoCookie(ctx.headers));
    return { pendente: !gate.liberado, email: ctx.session.user.email };
  }),

  verificar: authedProcedure
    .input(z.object({ codigo: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const token = lerSessionTokenDoCookie(ctx.headers);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });

      const r = await verificarDesafio(token, input.codigo);
      if (!r.ok) throw new TRPCError({ code: "FORBIDDEN", message: r.mensagem });
      return true;
    }),

  reenviar: authedProcedure.mutation(async ({ ctx }) => {
    const token = lerSessionTokenDoCookie(ctx.headers);
    const email = ctx.session.user.email;
    if (!token || !email) throw new TRPCError({ code: "UNAUTHORIZED" });

    await criarDesafioDeMfa(token, ctx.session.user.id, email);
    return true;
  }),

  usarRecovery: authedProcedure
    .input(z.object({ codigo: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const token = lerSessionTokenDoCookie(ctx.headers);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });

      const r = await usarRecoveryCode(token, ctx.session.user.id, input.codigo);
      if (!r.ok) throw new TRPCError({ code: "FORBIDDEN", message: r.mensagem });
      return true;
    }),

  // --- Ativação e desativação, a partir do /profile ---

  pedirCodigoDeAtivacao: authedProcedure.mutation(async ({ ctx }) => {
    const email = ctx.session.user.email;
    if (!email) throw new TRPCError({ code: "FORBIDDEN" });

    await pedirCodigoDeAtivacao(ctx.session.user.id, email);
    return true;
  }),

  ativar: authedProcedure
    .input(z.object({ codigo: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) throw new TRPCError({ code: "FORBIDDEN" });

      return ativarMfa(ctx.session.user.id, input.codigo, {
        email,
        ip: ctx.headers.get("x-forwarded-for"),
        userAgent: ctx.headers.get("user-agent"),
      });
    }),

  desativar: authedProcedure
    .input(z.object({ codigo: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) throw new TRPCError({ code: "FORBIDDEN" });

      const sessionRow = await getCurrentSessionRow(ctx.headers, ctx.db);
      await desativarMfa(ctx.session.user.id, {
        email,
        codigo: input.codigo,
        sessaoElevada: sessaoElevada(sessionRow),
        ip: ctx.headers.get("x-forwarded-for"),
        userAgent: ctx.headers.get("user-agent"),
      });
      return true;
    }),
});
