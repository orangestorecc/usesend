import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  INVITE_BLOQUEADO_POR_LIMITE,
  conviteExpirado,
  prazoDoConvite,
} from "~/lib/invites";
import { LimitService } from "~/server/service/limit-service";
import { LOCK_NS_USER_LIFECYCLE } from "~/server/service/account-deletion-service";

export const invitationRouter = createTRPCRouter({
  /**
   * Convites do e-mail da sessão. O `inviteId` só estreita a busca dentro do
   * que já é do usuário — passar o id de outra pessoa não devolve nada, que é
   * o que fecha a enumeração por id.
   */
  getUserInvites: protectedProcedure
    .input(
      z.object({
        inviteId: z.string().optional().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) {
        return [];
      }

      const invites = await ctx.db.teamInvite.findMany({
        where: {
          email: { equals: email, mode: "insensitive" },
          createdAt: { gte: prazoDoConvite() },
          ...(input.inviteId ? { id: input.inviteId } : {}),
        },
        include: {
          team: true,
        },
      });

      return invites;
    }),

  getInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) {
        return null;
      }

      const invite = await ctx.db.teamInvite.findFirst({
        where: {
          id: input.inviteId,
          email: { equals: email, mode: "insensitive" },
        },
      });

      if (!invite || conviteExpirado(invite)) {
        return null;
      }

      return invite;
    }),

  acceptTeamInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Sua conta não tem e-mail de acesso",
        });
      }

      const invite = await ctx.db.teamInvite.findUnique({
        where: { id: input.inviteId },
      });

      // Mesma resposta para convite inexistente e para convite de outra
      // pessoa: quem tenta adivinhar id alheio não descobre se acertou.
      if (
        !invite ||
        invite.email.toLowerCase() !== email.toLowerCase() ||
        conviteExpirado(invite)
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Convite não encontrado ou expirado",
        });
      }

      // Rechecagem no momento do aceite: o limite pode ter sido estourado
      // depois que o convite foi enviado (outro convidado entrou antes, ou o
      // plano caiu). Contar direto no banco, sem cache de contagem.
      const { isLimitReached, limit } = await LimitService.checkTeamMemberLimit(
        invite.teamId,
      );
      if (isLimitReached) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: INVITE_BLOQUEADO_POR_LIMITE,
          cause: { limit },
        });
      }

      await ctx.db.$transaction(async (tx) => {
        // Mesma lock da exclusão de conta: aceitar convite enquanto a conta
        // está sendo excluída deixaria um vínculo órfão.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NS_USER_LIFECYCLE}, hashtext(${String(
          ctx.session.user.id,
        )}))`;

        const conta = await tx.user.findUnique({
          where: { id: ctx.session.user.id },
          select: { deletedAt: true },
        });
        if (conta?.deletedAt) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Esta conta foi excluída",
          });
        }

        // O delete com `where` pelo id que ainda existe é o que serializa dois
        // aceites simultâneos do mesmo convite: o segundo não acha a linha.
        const consumido = await tx.teamInvite.deleteMany({
          where: { id: invite.id },
        });
        if (consumido.count === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Convite não encontrado ou expirado",
          });
        }

        await tx.teamUser.create({
          data: {
            teamId: invite.teamId,
            userId: ctx.session.user.id,
            role: invite.role,
          },
        });
      });

      return true;
    }),
});
