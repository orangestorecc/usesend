import { TRPCError } from "@trpc/server";
import { env } from "~/env";
import { db } from "~/server/db";
import { sendMail, sendTeamInviteEmail } from "~/server/mailer";
import { logger } from "~/server/logger/log";
import type { Prisma, Team, TeamInvite } from "@prisma/client";
import { UnsendApiError } from "../public-api/api-error";
import { getRedis, redisKey } from "~/server/redis";
import { LimitReason } from "~/lib/constants/plans";
import { LimitService } from "./limit-service";
import { renderUsageLimitReachedEmail } from "../email-templates/UsageLimitReachedEmail";
import { renderUsageWarningEmail } from "../email-templates/UsageWarningEmail";
import { provisionStarterTemplates } from "./starter-templates-service";
import { novoPrazoDeConvite } from "~/lib/invites";
import { invalidarLinksDoMembro } from "./access-link-service";

// Cache stores exactly Prisma Team shape (no counts)

const TEAM_CACHE_TTL_SECONDS = 120; // 2 minutes

export class TeamService {
  private static cacheKey(teamId: number) {
    return redisKey(`team:${teamId}`);
  }

  static async refreshTeamCache(teamId: number): Promise<Team | null> {
    const team = await db.team.findUnique({ where: { id: teamId } });

    if (!team) return null;

    const redis = getRedis();
    await redis.setex(
      TeamService.cacheKey(teamId),
      TEAM_CACHE_TTL_SECONDS,
      JSON.stringify(team),
    );
    return team;
  }

  static async invalidateTeamCache(teamId: number) {
    const redis = getRedis();
    await redis.del(TeamService.cacheKey(teamId));
  }

  static async getTeamCached(teamId: number): Promise<Team> {
    const redis = getRedis();
    const raw = await redis.get(TeamService.cacheKey(teamId));
    if (raw) {
      return JSON.parse(raw) as Team;
    }
    const fresh = await TeamService.refreshTeamCache(teamId);
    if (!fresh) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Workspace não encontrado" });
    }
    return fresh;
  }

  static async createTeam(
    userId: number,
    name: string,
  ): Promise<Team | undefined> {
    const teams = await db.team.findMany({
      where: {
        teamUsers: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (teams.length > 0) {
      logger.info({ userId }, "User already has a team");
      return;
    }

    if (!env.NEXT_PUBLIC_IS_CLOUD) {
      const _team = await db.team.findFirst();
      if (_team) {
        throw new TRPCError({
          message: "Não é possível ter múltiplos workspaces na versão self-hosted",
          code: "UNAUTHORIZED",
        });
      }
    }

    const created = await db.team.create({
      data: {
        name,
        teamUsers: {
          create: {
            userId,
            role: "ADMIN",
          },
        },
      },
    });
    // Warm cache for the new team
    await TeamService.refreshTeamCache(created.id);

    // Modelos iniciais de e-mail marketing; erro aqui não pode travar o cadastro
    try {
      await provisionStarterTemplates(created.id);
    } catch (error) {
      logger.error({ teamId: created.id, error }, "Falha ao provisionar modelos iniciais");
    }

    return created;
  }

  /**
   * Update a team and refresh the cache.
   * Returns the full Prisma Team object.
   */
  static async updateTeam(
    teamId: number,
    data: Prisma.TeamUpdateInput,
  ): Promise<Team> {
    const updated = await db.team.update({ where: { id: teamId }, data });
    await TeamService.refreshTeamCache(teamId);
    return updated;
  }

  static async getUserTeams(userId: number) {
    return db.team.findMany({
      where: {
        teamUsers: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        teamUsers: {
          where: {
            userId: userId,
          },
        },
      },
      // Ordem estável: o seletor de workspace não pode dançar entre requests.
      orderBy: { id: "asc" },
    });
  }

  static async getTeamUsers(teamId: number) {
    const teamUsers = await db.teamUser.findMany({
      where: {
        teamId,
      },
      // `include: { user: true }` entregava `mfaEnabled`, `subjectId`,
      // `pendingEmail` e `deletedAt` a qualquer MEMBER do time. A lista de
      // membros e os e-mails de aviso só precisam de id/nome/e-mail.
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { userId: "asc" },
    });

    // `joinedAt` é a entrada no time (TeamUser.createdAt). Sem esse campo a UI
    // acaba mostrando a criação da conta (`user.createdAt`), que é outra coisa.
    return teamUsers.map((teamUser) => ({
      ...teamUser,
      joinedAt: teamUser.createdAt,
    }));
  }

  static async getTeamInvites(teamId: number) {
    return db.teamInvite.findMany({
      where: {
        teamId,
      },
    });
  }

  static async createTeamInvite(
    teamId: number,
    email: string,
    role: "MEMBER" | "ADMIN",
    teamName: string,
    sendEmail: boolean = true,
  ): Promise<TeamInvite> {
    if (!email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "O e-mail é obrigatório",
      });
    }

    const { isLimitReached } = await LimitService.checkTeamMemberLimit(teamId);
    if (isLimitReached) {
      throw new UnsendApiError({
        code: "FORBIDDEN",
        message: "Limite de convites do workspace atingido",
      });
    }

    const user = await db.user.findUnique({
      where: {
        email,
      },
      include: {
        teamUsers: true,
      },
    });

    if (user) {
      // Já ser membro DESTE time é sempre recusa: o convite não teria efeito.
      if (user.teamUsers.some((tu) => tu.teamId === teamId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este usuário já faz parte deste workspace",
        });
      }

      // Na nuvem uma pessoa pode pertencer a vários workspaces; na versão
      // self-hosted a regra continua sendo um único time por usuário.
      if (!env.NEXT_PUBLIC_IS_CLOUD && user.teamUsers.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Usuário já faz parte de um workspace",
        });
      }
    }

    const teamInvite = await db.teamInvite.create({
      data: {
        teamId,
        email,
        role,
        expiresAt: novoPrazoDeConvite(),
      },
    });

    const teamUrl = `${env.NEXTAUTH_URL}/join-team?inviteId=${teamInvite.id}`;

    if (sendEmail) {
      try {
        await sendTeamInviteEmail(email, teamUrl, teamName);
      } catch (err) {
        // Sem e-mail entregue o convite viraria um "Pendente" fantasma: o
        // convidado nunca recebe o link e o admin acha que foi enviado.
        await db.teamInvite.delete({ where: { id: teamInvite.id } });
        logger.error({ err, email, teamId }, "Falha ao enviar convite de time");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Não foi possível enviar o e-mail do convite. Verifique o domínio de envio do sistema e tente de novo.",
        });
      }
    }

    return teamInvite;
  }

  static async updateTeamUserRole(
    teamId: number,
    userId: string,
    role: "MEMBER" | "ADMIN",
  ) {
    const teamUser = await db.teamUser.findFirst({
      where: {
        teamId,
        userId: Number(userId),
      },
    });

    if (!teamUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Membro do workspace não encontrado",
      });
    }

    // Check if this is the last admin
    const adminCount = await db.teamUser.count({
      where: {
        teamId,
        role: "ADMIN",
      },
    });

    if (adminCount === 1 && teamUser.role === "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "É necessário pelo menos um administrador",
      });
    }

    const updated = await db.$transaction(async (tx) => {
      const atualizado = await tx.teamUser.update({
        where: {
          teamId_userId: {
            teamId,
            userId: Number(userId),
          },
        },
        data: {
          role,
        },
      });

      // Virar ADMIN invalida os links pendentes daquela pessoa: a emissão
      // recusa alvo ADMIN, mas o resgate acontece até 30 minutos depois — sem
      // isto, promover alguém dentro da janela entregava um link que a política
      // já proíbe. A rota de resgate reconfere o papel de qualquer forma; são
      // as duas metades da mesma regra.
      if (role === "ADMIN") {
        await invalidarLinksDoMembro(teamId, Number(userId), tx);
      }

      return atualizado;
    });
    // Role updates might influence permissions; refresh cache to be safe
    await TeamService.invalidateTeamCache(teamId);
    return updated;
  }

  static async deleteTeamUser(
    teamId: number,
    userId: string,
    requestorRole: string,
    requestorId: number,
  ) {
    const teamUser = await db.teamUser.findFirst({
      where: {
        teamId,
        userId: Number(userId),
      },
    });

    if (!teamUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Membro do workspace não encontrado",
      });
    }

    if (requestorRole !== "ADMIN" && requestorId !== Number(userId)) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Você não tem autorização para remover este membro do workspace",
      });
    }

    // Check if this is the last admin
    const adminCount = await db.teamUser.count({
      where: {
        teamId,
        role: "ADMIN",
      },
    });

    if (adminCount === 1 && teamUser.role === "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "É necessário pelo menos um administrador",
      });
    }

    const deleted = await db.$transaction(async (tx) => {
      const removido = await tx.teamUser.delete({
        where: {
          teamId_userId: {
            teamId,
            userId: Number(userId),
          },
        },
      });

      // Link de 30 minutos não pode sobreviver à saída do time, e nem a sessão
      // que já tinha nascido dele.
      await invalidarLinksDoMembro(teamId, Number(userId), tx);

      return removido;
    });
    await TeamService.invalidateTeamCache(teamId);
    return deleted;
  }

  static async resendTeamInvite(
    teamId: number,
    inviteId: string,
    teamName: string,
  ) {
    const invite = await db.teamInvite.findFirst({
      where: {
        teamId,
        id: {
          equals: inviteId,
        },
      },
    });

    if (!invite) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Convite não encontrado",
      });
    }

    const teamUrl = `${env.NEXTAUTH_URL}/join-team?inviteId=${invite.id}`;

    // Reenviar tem que RENOVAR o prazo: sem isto o botão só aparece quando o
    // convite já venceu e o link reenviado estoura no aceite.
    // Ordem importa: só renova depois que o e-mail saiu de fato. Se o envio
    // falhar, o convite fica exatamente como estava.
    await sendTeamInviteEmail(invite.email, teamUrl, teamName);

    const renovado = await db.teamInvite.update({
      where: { id: invite.id },
      data: { expiresAt: novoPrazoDeConvite() },
    });

    return { success: true, expiresAt: renovado.expiresAt };
  }

  static async deleteTeamInvite(teamId: number, inviteId: string) {
    const invite = await db.teamInvite.findFirst({
      where: {
        teamId,
        id: {
          equals: inviteId,
        },
      },
    });

    if (!invite) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Convite não encontrado",
      });
    }

    return db.teamInvite.delete({
      where: {
        teamId_email: {
          teamId,
          email: invite.email,
        },
      },
    });
  }

  /**
   * Notify all team users that email limit has been reached, at most once per day.
   */
  static async maybeNotifyEmailLimitReached(
    teamId: number,
    limit: number,
    reason: LimitReason | undefined,
  ) {
    logger.info(
      { teamId, limit, reason },
      "[TeamService]: maybeNotifyEmailLimitReached called",
    );
    if (!reason) {
      logger.info(
        { teamId },
        "[TeamService]: Skipping notify — no reason provided",
      );
      return;
    }
    // Only notify on actual email limit reasons
    if (
      ![
        LimitReason.EMAIL_DAILY_LIMIT_REACHED,
        LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
      ].includes(reason)
    ) {
      logger.info(
        { teamId, reason },
        "[TeamService]: Skipping notify — reason not eligible",
      );
      return;
    }

    const redis = getRedis();
    const cacheKey = redisKey(`limit:notify:${teamId}:${reason}`);
    // Atomic SET NX to prevent race conditions: only one concurrent caller
    // can acquire the cooldown key. TTL = 24 hours (one notification per day).
    const acquired = await redis.set(cacheKey, "1", "EX", 24 * 60 * 60, "NX");
    if (acquired !== "OK") {
      logger.info(
        { teamId, cacheKey },
        "[TeamService]: Skipping notify — cooldown active",
      );
      return; // another request already claimed this window
    }

    const team = await TeamService.getTeamCached(teamId);
    // Only consider it a paid plan if the subscription is active
    const isPaidPlan = team.isActive && team.plan !== "FREE";

    const html = await getLimitReachedEmail(teamId, limit, reason);

    const subject =
      reason === LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED
        ? "Madmail: Você atingiu seu limite mensal de e-mails"
        : "Madmail: Você atingiu seu limite diário de e-mails";

    const text = `Olá, ${team.name},\n\nVocê atingiu seu limite ${
      reason === LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED
        ? "mensal"
        : "diário"
    } de ${limit.toLocaleString()} e-mails.\n\nO envio está temporariamente pausado até o limite ser renovado ou ${
      isPaidPlan ? "seu workspace ser verificado" : "seu plano ser atualizado"
    }.\n\nGerenciar plano: ${env.NEXTAUTH_URL}/settings`;

    const teamUsers = await TeamService.getTeamUsers(teamId);
    const recipients = teamUsers
      .map((tu) => tu.user?.email)
      .filter((e): e is string => Boolean(e));

    logger.info(
      { teamId, recipientsCount: recipients.length, reason },
      "[TeamService]: Sending limit reached notifications",
    );

    // Send individually to all team users
    try {
      await Promise.all(
        recipients.map((to) =>
          sendMail(to, subject, text, html, "suporte@madmail.com.br"),
        ),
      );
      logger.info(
        { teamId, recipientsCount: recipients.length },
        "[TeamService]: Limit reached notifications sent",
      );
    } catch (err) {
      logger.error(
        { err, teamId },
        "[TeamService]: Failed sending limit reached notifications",
      );
      throw err;
    }
  }

  /**
   * Notify all team users that they're nearing their email limit.
   * Rate limited via Redis to avoid spamming; sends at most once per day per reason.
   */
  static async sendWarningEmail(
    teamId: number,
    used: number,
    limit: number,
    reason: LimitReason | undefined,
  ) {
    logger.info(
      { teamId, used, limit, reason },
      "[TeamService]: sendWarningEmail called",
    );
    if (!reason) {
      logger.info(
        { teamId },
        "[TeamService]: Skipping warning — no reason provided",
      );
      return;
    }

    if (
      ![
        LimitReason.EMAIL_DAILY_LIMIT_REACHED,
        LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
      ].includes(reason)
    ) {
      logger.info(
        { teamId, reason },
        "[TeamService]: Skipping warning — reason not eligible",
      );
      return;
    }

    const redis = getRedis();
    const cacheKey = redisKey(`limit:warning:${teamId}:${reason}`);
    // Atomic SET NX to prevent race conditions: only one concurrent caller
    // can acquire the cooldown key. TTL = 24 hours (one notification per day).
    const acquired = await redis.set(cacheKey, "1", "EX", 24 * 60 * 60, "NX");
    if (acquired !== "OK") {
      logger.info(
        { teamId, cacheKey },
        "[TeamService]: Skipping warning — cooldown active",
      );
      return; // another request already claimed this window
    }

    const team = await TeamService.getTeamCached(teamId);
    // Only consider it a paid plan if the subscription is active
    const isPaidPlan = team.isActive && team.plan !== "FREE";

    const period =
      reason === LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED
        ? "monthly"
        : "daily";

    const html = await renderUsageWarningEmail({
      teamName: team.name,
      used,
      limit,
      isPaidPlan,
      period,
      manageUrl: `${env.NEXTAUTH_URL}/settings`,
    });

    const subject =
      period === "monthly"
        ? "Madmail: Você está perto do seu limite mensal de e-mails"
        : "Madmail: Você está perto do seu limite diário de e-mails";

    const text = `Olá, ${team.name},\n\nVocê já usou ${used.toLocaleString()} do seu limite ${
      period === "monthly" ? "mensal" : "diário"
    } de ${limit.toLocaleString()} e-mails.\n\nConsidere ${
      isPaidPlan
        ? "verificar seu workspace respondendo a este e-mail"
        : "atualizar seu plano"
    }.\n\nGerenciar plano: ${env.NEXTAUTH_URL}/settings`;

    const teamUsers = await TeamService.getTeamUsers(teamId);
    const recipients = teamUsers
      .map((tu) => tu.user?.email)
      .filter((e): e is string => Boolean(e));

    logger.info(
      { teamId, recipientsCount: recipients.length, reason },
      "[TeamService]: Sending warning notifications",
    );

    try {
      await Promise.all(
        recipients.map((to) =>
          sendMail(to, subject, text, html, "suporte@madmail.com.br"),
        ),
      );
      logger.info(
        { teamId, recipientsCount: recipients.length },
        "[TeamService]: Warning notifications sent",
      );
    } catch (err) {
      logger.error(
        { err, teamId },
        "[TeamService]: Failed sending warning notifications",
      );
      throw err;
    }
  }
}

async function getLimitReachedEmail(
  teamId: number,
  limit: number,
  reason: LimitReason,
) {
  const team = await TeamService.getTeamCached(teamId);
  const isPaidPlan = team.isActive && team.plan !== "FREE";
  const email = await renderUsageLimitReachedEmail({
    teamName: team.name,
    limit,
    isPaidPlan,
    period:
      reason === LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED
        ? "monthly"
        : "daily",
    manageUrl: `${env.NEXTAUTH_URL}/settings`,
  });
  return email;
}
