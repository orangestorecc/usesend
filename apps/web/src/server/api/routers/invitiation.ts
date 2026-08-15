import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  semAcessoAssistidoProcedure,
} from "~/server/api/trpc";
import { INVITE_BLOQUEADO_POR_LIMITE, conviteExpirado } from "~/lib/invites";
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
          // Prazo explícito: reenviar renova `expiresAt`, então filtrar por
          // `createdAt` esconderia convite renovado.
          expiresAt: { gt: new Date() },
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

  /**
   * Fora do acesso assistido: aceitar convite entra a conta num workspace novo
   * e o `inviteId` não carrega `teamId`, então o choke point genérico não o vê.
   * Quem decide de que times a pessoa participa é a pessoa.
   */
  acceptTeamInvite: semAcessoAssistidoProcedure
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

      // Já ser membro do time é caso de sucesso, não de erro: o convite se
      // resolve sozinho (é consumido) e o usuário segue para o workspace.
      const jaEMembro = await ctx.db.teamUser.findFirst({
        where: { teamId: invite.teamId, userId: ctx.session.user.id },
        select: { teamId: true },
      });
      if (jaEMembro) {
        await ctx.db.teamInvite.deleteMany({ where: { id: invite.id } });
        return true;
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
        // O ::int4 é obrigatório: o Prisma manda número JS como int8 e a
        // versão de dois argumentos de pg_advisory_xact_lock só existe em
        // (int4, int4) — sem o cast o Postgres não acha a função.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NS_USER_LIFECYCLE}::int4, hashtext(${String(
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

        // `skipDuplicates` fecha a corrida com um vínculo criado entre a
        // checagem acima e aqui: aceitar duas vezes não estoura unique.
        await tx.teamUser.createMany({
          data: [
            {
              teamId: invite.teamId,
              userId: ctx.session.user.id,
              role: invite.role,
            },
          ],
          skipDuplicates: true,
        });
      });

      return true;
    }),
});
