import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  getCurrentSessionRow,
  lerSessionTokenDoCookie,
  sessaoElevada,
} from "~/server/auth-session";
import { registrarAuditoria } from "~/server/service/audit-service";
import {
  confirmarTrocaDeEmail,
  iniciarTrocaDeEmail,
  pedirCodigoDoEmailNovo,
} from "~/server/service/email-change-service";
import {
  excluirConta,
  listarBloqueios,
  pedirCodigoDeExclusao,
} from "~/server/service/account-deletion-service";
import { TeamService } from "~/server/service/team-service";
import { invalidarLinksDoMembro } from "~/server/service/access-link-service";

export const userRouter = createTRPCRouter({
  /** Tudo que a tela /profile precisa numa consulta só. */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        mfaEnabled: true,
        mfaEnabledAt: true,
        pendingEmail: true,
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Conta não encontrada" });
    }

    const [teamUsers, invites, contas, trocaEmAndamento, sessionRow] =
      await Promise.all([
        ctx.db.teamUser.findMany({
          where: { userId: user.id },
          include: { team: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        }),
        user.email
          ? ctx.db.teamInvite.findMany({
              where: {
                email: { equals: user.email, mode: "insensitive" },
                expiresAt: { gt: new Date() },
              },
              include: { team: { select: { id: true, name: true } } },
            })
          : Promise.resolve([]),
        ctx.db.account.findMany({
          where: { userId: user.id },
          select: { provider: true, providerAccountId: true },
        }),
        ctx.db.emailChangeRequest.findFirst({
          where: {
            userId: user.id,
            revertedAt: null,
            revertDeadline: { gt: new Date() },
          },
          select: { newEmail: true, oldEmail: true, revertDeadline: true },
        }),
        getCurrentSessionRow(ctx.headers, ctx.db),
      ]);

    // Admin do time só pode sair se houver outro admin — a UI precisa saber
    // disso antes de mostrar o botão, não depois do erro.
    const adminsPorTime = await ctx.db.teamUser.groupBy({
      by: ["teamId"],
      where: {
        teamId: { in: teamUsers.map((t) => t.teamId) },
        role: "ADMIN",
      },
      _count: { _all: true },
    });

    // Acesso assistido não é a conta da pessoa: vê o workspace de onde o link
    // saiu e nada mais. A lista de times e os convites pendentes dela em outras
    // empresas não são do admin que emitiu o link.
    const preso = ctx.acessoPresoAoTime;
    const timesVisiveis =
      preso === null ? teamUsers : teamUsers.filter((tu) => tu.teamId === preso);
    const convitesVisiveis = preso === null ? invites : [];

    return {
      user,
      elevada: sessaoElevada(sessionRow),
      times: timesVisiveis.map((tu) => ({
        teamId: tu.teamId,
        nome: tu.team.name,
        papel: tu.role,
        membroDesde: tu.createdAt,
        ultimoAdmin:
          tu.role === "ADMIN" &&
          (adminsPorTime.find((a) => a.teamId === tu.teamId)?._count._all ??
            0) <= 1,
      })),
      convites: convitesVisiveis.map((i) => ({
        id: i.id,
        time: i.team.name,
        papel: i.role,
        criadoEm: i.createdAt,
      })),
      contasVinculadas: contas,
      trocaDeEmailEmAndamento: trocaEmAndamento,
    };
  }),

  updateName: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { name: input.name },
      });
      return true;
    }),

  /** Passo 1 do stepper: código ao e-mail atual, pulado se a sessão está elevada. */
  requestEmailChange: protectedProcedure.mutation(async ({ ctx }) => {
    const sessionRow = await getCurrentSessionRow(ctx.headers, ctx.db);
    if (sessaoElevada(sessionRow)) {
      return { codigoEnviado: false };
    }

    const email = ctx.session.user.email;
    if (!email) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Sua conta não tem e-mail de acesso",
      });
    }

    await iniciarTrocaDeEmail(ctx.session.user.id, email);
    return { codigoEnviado: true };
  }),

  /** Passo 2: prova o e-mail atual e dispara o código para o endereço novo. */
  setNewEmail: protectedProcedure
    .input(
      z.object({
        newEmail: z.string().email(),
        codigoAtual: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionRow = await getCurrentSessionRow(ctx.headers, ctx.db);
      return pedirCodigoDoEmailNovo(ctx.session.user.id, input.newEmail, {
        codigoAtual: input.codigoAtual,
        sessaoElevada: sessaoElevada(sessionRow),
      });
    }),

  /** Passo 3: código ao e-mail novo — este nunca é dispensado. */
  confirmEmailChange: protectedProcedure
    .input(z.object({ codigo: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const token = lerSessionTokenDoCookie(ctx.headers);
      return confirmarTrocaDeEmail(ctx.session.user.id, input.codigo, {
        ip: ctx.headers.get("x-forwarded-for"),
        userAgent: ctx.headers.get("user-agent"),
        sessionToken: token,
      });
    }),

  /** Membros do time que podem receber a administração. */
  membrosDoTime: protectedProcedure
    .input(z.object({ teamId: z.number() }))
    .query(async ({ ctx, input }) => {
      const meu = await ctx.db.teamUser.findFirst({
        where: { teamId: input.teamId, userId: ctx.session.user.id },
      });
      if (!meu) throw new TRPCError({ code: "NOT_FOUND" });

      const membros = await ctx.db.teamUser.findMany({
        where: { teamId: input.teamId, userId: { not: ctx.session.user.id } },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      return membros.map((m) => ({
        userId: m.userId,
        nome: m.user.name,
        email: m.user.email,
        papel: m.role,
      }));
    }),

  sairDoTime: protectedProcedure
    .input(z.object({ teamId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async (tx) => {
        const meu = await tx.teamUser.findFirst({
          where: { teamId: input.teamId, userId: ctx.session.user.id },
        });
        if (!meu) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Você não faz parte deste workspace",
          });
        }

        if (meu.role === "ADMIN") {
          const admins = await tx.teamUser.count({
            where: { teamId: input.teamId, role: "ADMIN" },
          });
          if (admins <= 1) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Você é o único admin. Transfira a administração ou exclua o workspace.",
            });
          }
        }

        await tx.teamUser.delete({
          where: {
            teamId_userId: { teamId: input.teamId, userId: ctx.session.user.id },
          },
        });

        // Mesma regra do `deleteTeamUser`: sair do time mata os links pendentes
        // e as sessões que já nasceram presas a ele. Estava só numa das portas.
        await invalidarLinksDoMembro(input.teamId, ctx.session.user.id, tx);

        await registrarAuditoria(
          "team_left",
          {
            actorUserId: ctx.session.user.id,
            actorEmail: ctx.session.user.email,
            targetUserId: ctx.session.user.id,
            targetEmail: ctx.session.user.email,
            metadata: { teamId: input.teamId },
          },
          tx,
        );
      });

      await TeamService.invalidateTeamCache(input.teamId);
      return true;
    }),

  /**
   * Promove outro membro e sai, numa transação só. Fazer em dois passos
   * deixaria o time sem admin se o segundo falhasse.
   */
  transferirAdministracao: protectedProcedure
    .input(z.object({ teamId: z.number(), paraUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async (tx) => {
        const meu = await tx.teamUser.findFirst({
          where: {
            teamId: input.teamId,
            userId: ctx.session.user.id,
            role: "ADMIN",
          },
        });
        if (!meu) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Só um admin pode transferir a administração",
          });
        }

        const destino = await tx.teamUser.findFirst({
          where: { teamId: input.teamId, userId: input.paraUserId },
        });
        if (!destino) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Membro não encontrado neste workspace",
          });
        }

        await tx.teamUser.update({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: input.paraUserId,
            },
          },
          data: { role: "ADMIN" },
        });

        // Quem virou ADMIN não pode continuar com link de acesso pendente: a
        // política recusa emitir link para admin, então um link emitido 5
        // minutos antes da promoção não pode sobreviver a ela.
        await invalidarLinksDoMembro(input.teamId, input.paraUserId, tx);

        await tx.teamUser.delete({
          where: {
            teamId_userId: { teamId: input.teamId, userId: ctx.session.user.id },
          },
        });

        await invalidarLinksDoMembro(input.teamId, ctx.session.user.id, tx);

        await registrarAuditoria(
          "team_left",
          {
            actorUserId: ctx.session.user.id,
            actorEmail: ctx.session.user.email,
            targetUserId: ctx.session.user.id,
            targetEmail: ctx.session.user.email,
            metadata: {
              teamId: input.teamId,
              administracaoTransferidaPara: input.paraUserId,
            },
          },
          tx,
        );
      });

      await TeamService.invalidateTeamCache(input.teamId);
      return true;
    }),

  /** Desvincular provider social. */
  desvincularConta: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const contas = await ctx.db.account.findMany({
        where: { userId: ctx.session.user.id },
      });

      const alvo = contas.find((c) => c.provider === input.provider);
      if (!alvo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta não vinculada",
        });
      }

      // Login por e-mail continua existindo sempre, então desvincular o
      // último provider não tranca ninguém para fora.
      await ctx.db.account.delete({ where: { id: alvo.id } });
      return true;
    }),

  /** Checklist da exclusão: o que ainda impede, para resolver no dialog. */
  bloqueiosDaExclusao: protectedProcedure.query(async ({ ctx }) => {
    return listarBloqueios(ctx.session.user.id);
  }),

  requestAccountDeletion: protectedProcedure.mutation(async ({ ctx }) => {
    const sessionRow = await getCurrentSessionRow(ctx.headers, ctx.db);
    if (sessaoElevada(sessionRow)) {
      return { codigoEnviado: false };
    }

    const email = ctx.session.user.email;
    if (!email) throw new TRPCError({ code: "FORBIDDEN" });

    await pedirCodigoDeExclusao(ctx.session.user.id, email);
    return { codigoEnviado: true };
  }),

  confirmAccountDeletion: protectedProcedure
    .input(z.object({ codigo: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) throw new TRPCError({ code: "FORBIDDEN" });

      const sessionRow = await getCurrentSessionRow(ctx.headers, ctx.db);
      await excluirConta(ctx.session.user.id, {
        email,
        codigo: input.codigo,
        sessaoElevada: sessaoElevada(sessionRow),
        ip: ctx.headers.get("x-forwarded-for"),
        userAgent: ctx.headers.get("user-agent"),
      });
      return true;
    }),

  listLinkedAccounts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.account.findMany({
      where: { userId: ctx.session.user.id },
      select: { id: true, provider: true, providerAccountId: true },
    });
  }),

  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const atual = lerSessionTokenDoCookie(ctx.headers);
    const sessions = await ctx.db.session.findMany({
      where: { userId: ctx.session.user.id, expires: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sessionToken: true,
        createdAt: true,
        expires: true,
        userAgent: true,
        ip: true,
        mfaVerifiedAt: true,
      },
    });

    // O token nunca sai daqui — a tela só precisa saber qual linha é a atual.
    return sessions.map(({ sessionToken, ...s }) => ({
      ...s,
      atual: sessionToken === atual,
    }));
  }),

  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alvo = await ctx.db.session.findFirst({
        where: { id: input.sessionId, userId: ctx.session.user.id },
      });
      if (!alvo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sessão não encontrada",
        });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.session.delete({ where: { id: alvo.id } });
        await registrarAuditoria(
          "session_revoked",
          {
            actorUserId: ctx.session.user.id,
            actorEmail: ctx.session.user.email,
            targetUserId: ctx.session.user.id,
            targetEmail: ctx.session.user.email,
            metadata: { sessionId: alvo.id },
          },
          tx,
        );
      });

      return true;
    }),

  /** Encerra tudo menos a sessão atual — sair daqui também seria hostil. */
  revokeAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const atual = lerSessionTokenDoCookie(ctx.headers);

    const { count } = await ctx.db.session.deleteMany({
      where: {
        userId: ctx.session.user.id,
        ...(atual ? { sessionToken: { not: atual } } : {}),
      },
    });

    return { encerradas: count };
  }),
});
