import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  semAcessoAssistidoProcedure,
  teamProcedure,
  teamAdminProcedure,
} from "~/server/api/trpc";
import { TeamService } from "~/server/service/team-service";
import { resolverTimeAtivo } from "~/server/service/active-team";
import {
  enviarLinkDeAcesso,
  gerarLinkDeAcesso,
} from "~/server/service/access-link-service";

/** A UI manda o id como string (padrão das outras rotas de time). */
const userIdInput = z.object({ userId: z.coerce.number().int().positive() });

export const teamRouter = createTRPCRouter({
  createTeam: semAcessoAssistidoProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.createTeam(ctx.session.user.id, input.name);
    }),

  /**
   * Times do usuário, cada um marcado com `ativoNoServidor`: qual deles o
   * servidor REALMENTE resolveria neste request (cookie revalidado, mesma
   * função do `teamProcedure`).
   *
   * Existe porque a UI recebe o workspace ativo congelado no render do
   * servidor: com duas abas, a aba antiga renderiza dados do time novo com o
   * nome/papel do time antigo. Com este campo o cliente detecta a divergência
   * sem um request a mais — a lista já é carregada pelo seletor de workspace.
   */
  getTeams: protectedProcedure.query(async ({ ctx }) => {
    // Sessão presa a um time só enxerga aquele time. A lista completa dizia ao
    // admin do time A em que outros workspaces a pessoa trabalha — informação
    // que não é dele, e que era o mapa para a próxima tentativa de escapar.
    if (ctx.acessoPresoAoTime !== null) {
      const preso = ctx.acessoPresoAoTime;
      const times = await TeamService.getUserTeams(ctx.session.user.id);
      return times
        .filter((team) => team.id === preso)
        .map((team) => ({ ...team, ativoNoServidor: true }));
    }

    const [times, ativo] = await Promise.all([
      TeamService.getUserTeams(ctx.session.user.id),
      resolverTimeAtivo(ctx.session.user.id, ctx.headers, ctx.db),
    ]);

    return times.map((team) => ({
      ...team,
      ativoNoServidor: team.id === ativo?.teamId,
    }));
  }),

  getTeamUsers: teamProcedure.query(async ({ ctx }) => {
    return TeamService.getTeamUsers(ctx.team.id);
  }),

  getTeamInvites: teamProcedure.query(async ({ ctx }) => {
    return TeamService.getTeamInvites(ctx.team.id);
  }),

  createTeamInvite: teamAdminProcedure
    .input(
      z.object({
        email: z.string(),
        role: z.enum(["MEMBER", "ADMIN"]),
        sendEmail: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return TeamService.createTeamInvite(
        ctx.team.id,
        input.email,
        input.role,
        ctx.team.name,
        input.sendEmail,
      );
    }),

  updateTeamUserRole: teamAdminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["MEMBER", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return TeamService.updateTeamUserRole(
        ctx.team.id,
        input.userId,
        input.role,
      );
    }),

  deleteTeamUser: teamProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.deleteTeamUser(
        ctx.team.id,
        input.userId,
        ctx.teamUser.role,
        ctx.session.user.id,
      );
    }),

  resendTeamInvite: teamAdminProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.resendTeamInvite(
        ctx.team.id,
        input.inviteId,
        ctx.team.name,
      );
    }),

  deleteTeamInvite: teamAdminProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.deleteTeamInvite(ctx.team.id, input.inviteId);
    }),

  /** Link de acesso de uso único; a URL volta para o admin copiar. */
  createAccessLink: teamAdminProcedure
    .input(userIdInput)
    .mutation(async ({ ctx, input }) => {
      return gerarLinkDeAcesso({
        teamId: ctx.team.id,
        targetUserId: input.userId,
        atorUserId: ctx.session.user.id,
      });
    }),

  /** Mesmo link, mas entregue por e-mail — o admin nunca vê a URL. */
  sendAccessLink: teamAdminProcedure
    .input(userIdInput)
    .mutation(async ({ ctx, input }) => {
      return enviarLinkDeAcesso({
        teamId: ctx.team.id,
        targetUserId: input.userId,
        atorUserId: ctx.session.user.id,
        teamName: ctx.team.name,
      });
    }),
});
