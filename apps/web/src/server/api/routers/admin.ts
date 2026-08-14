import { Prisma, type Plan } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "~/env";

import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  aprovarResetDeMfa,
  solicitarResetDeMfa,
} from "~/server/service/mfa-reset-service";
import { SesSettingsService } from "~/server/service/ses-settings-service";
import { getAccount } from "~/server/aws/ses";
import { db } from "~/server/db";
import { sendMail } from "~/server/mailer";
import { logger } from "~/server/logger/log";
import { UseSend } from "usesend-js";
import { isCloud } from "~/utils/common";
import { toPlainHtml } from "~/server/utils/email-content";
import { sesRegionSchema } from "~/lib/zod/ses-setting-schema";
import {
  buildCustomerKpis,
  contarCancelamentos,
  loadCustomerFinancials,
} from "~/server/billing/customer-insights";
import { FREE_PLAN_KEY, aplicarPlano } from "~/server/billing/plan-service";
import { registrarAuditoria } from "~/server/service/audit-service";
import { podeRemoverAdmin } from "~/server/service/platform-admin";
import { downgradeParaGratis } from "~/server/billing/lifecycle-service";

const waitlistUserSelection = {
  id: true,
  email: true,
  name: true,
  isWaitlisted: true,
  createdAt: true,
} as const;

function formatDisplayNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? email;
  const pieces = localPart.split(/[._-]+/).filter(Boolean);
  if (pieces.length === 0) {
    return localPart;
  }
  return pieces
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(" ");
}

const teamAdminSelection = {
  id: true,
  name: true,
  plan: true,
  planKey: true,
  planProduct: true,
  billingBlockedAt: true,
  apiRateLimit: true,
  dailyEmailLimit: true,
  isBlocked: true,
  billingEmail: true,
  createdAt: true,
  teamUsers: {
    select: {
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  },
  domains: {
    select: {
      id: true,
      name: true,
      status: true,
      isVerifying: true,
    },
  },
} as const;

export const adminRouter = createTRPCRouter({
  getSesSettings: adminProcedure.query(async () => {
    return SesSettingsService.getAllSettings();
  }),

  getDefaultSesRegion: adminProcedure.query(() => env.AWS_DEFAULT_REGION),

  getQuotaForRegion: adminProcedure
    .input(
      z.object({
        region: sesRegionSchema,
      }),
    )
    .query(async ({ input }) => {
      const acc = await getAccount(input.region);
      return acc.SendQuota?.MaxSendRate;
    }),

  addSesSettings: adminProcedure
    .input(
      z.object({
        region: sesRegionSchema,
        usesendUrl: z.string().url(),
        sendRate: z.number(),
        transactionalQuota: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      return SesSettingsService.createSesSetting({
        region: input.region,
        usesendUrl: input.usesendUrl,
        sendingRateLimit: input.sendRate,
        transactionalQuota: input.transactionalQuota,
      });
    }),

  updateSesSettings: adminProcedure
    .input(
      z.object({
        settingsId: z.string(),
        sendRate: z.number(),
        transactionalQuota: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      return SesSettingsService.updateSesSetting({
        id: input.settingsId,
        sendingRateLimit: input.sendRate,
        transactionalQuota: input.transactionalQuota,
      });
    }),

  getSetting: adminProcedure
    .input(
      z.object({
        region: z.string().optional().nullable(),
      }),
    )
    .query(async ({ input }) => {
      return SesSettingsService.getSetting(
        input.region ?? env.AWS_DEFAULT_REGION,
      );
    }),

  findUserByEmail: adminProcedure
    .input(
      z.object({
        email: z
          .string()
          .email()
          .transform((value) => value.toLowerCase()),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await db.user.findUnique({
        where: { email: input.email },
        select: waitlistUserSelection,
      });

      return user ?? null;
    }),

  updateUserWaitlist: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        isWaitlisted: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const existingUser = await db.user.findUnique({
        where: { id: input.userId },
        select: waitlistUserSelection,
      });

      if (!existingUser) {
        throw new Error("Usuário não encontrado");
      }

      const updatedUser = await db.user.update({
        where: { id: input.userId },
        data: { isWaitlisted: input.isWaitlisted },
        select: waitlistUserSelection,
      });

      const founderEmail = env.FOUNDER_EMAIL ?? undefined;
      const fallbackFrom = env.FROM_EMAIL ?? env.ADMIN_EMAIL ?? undefined;

      const shouldSendAcceptanceEmail =
        existingUser.isWaitlisted &&
        !input.isWaitlisted &&
        Boolean(updatedUser.email) &&
        (founderEmail || fallbackFrom);

      // Add user to contact book when removed from waitlist (cloud only)
      if (
        existingUser.isWaitlisted &&
        !input.isWaitlisted &&
        isCloud() &&
        env.CONTACT_BOOK_ID &&
        updatedUser.email
      ) {
        try {
          const client = new UseSend(env.USESEND_API_KEY);

          // Split name into first and last name if available
          const firstName = updatedUser.name || "";

          const result = await client.contacts.create(env.CONTACT_BOOK_ID, {
            email: updatedUser.email,
            firstName: firstName,
          });

          if (result.error) {
            logger.error(
              {
                userId: updatedUser.id,
                email: updatedUser.email,
                error: result.error,
              },
              "Failed to add user to contact book",
            );
          } else {
            logger.info(
              {
                userId: updatedUser.id,
                email: updatedUser.email,
                contactId: result.data?.contactId,
              },
              "Successfully added user to contact book",
            );
          }
        } catch (error) {
          logger.error(
            {
              userId: updatedUser.id,
              email: updatedUser.email,
              error,
            },
            "Error adding user to contact book",
          );
        }
      }

      if (shouldSendAcceptanceEmail) {
        const recipient = updatedUser.email as string;
        const replyTo = founderEmail ?? fallbackFrom;
        const fromOverride = founderEmail ?? undefined;
        const founderName = replyTo
          ? formatDisplayNameFromEmail(replyTo)
          : "Founder";
        const userFirstName =
          updatedUser.name?.split(" ")[0] ?? updatedUser.name ?? recipient;

        const text = `Hey ${userFirstName},\n\nThanks for hanging in while we reviewed your waitlist request. I've just moved your account off the waitlist, so you now have full access to Madmail.\n\nGo ahead and log back in to start sending: ${env.NEXTAUTH_URL}\n\nIf anything feels unclear or you want help getting set up, reply to this email and it comes straight to me.\n\nCheers,\n${founderName}\n${replyTo}`;

        try {
          await sendMail(
            recipient,
            "Madmail: You're off the waitlist",
            text,
            toPlainHtml(text),
            replyTo,
            fromOverride,
          );
        } catch (error) {
          logger.error(
            { userId: updatedUser.id, error },
            "Failed to send waitlist acceptance email",
          );
        }
      }

      return updatedUser;
    }),

  rejectWaitlistUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await db.user.findUnique({
        where: { id: input.userId },
        select: waitlistUserSelection,
      });

      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      if (!user.email) {
        throw new Error("O e-mail do usuário está faltando");
      }

      const founderEmail = env.FOUNDER_EMAIL ?? undefined;
      const fallbackFrom = env.FROM_EMAIL ?? env.ADMIN_EMAIL ?? undefined;

      const replyTo = founderEmail ?? fallbackFrom;

      if (!replyTo) {
        throw new Error("Nenhum e-mail de remetente configurado");
      }

      const fromOverride = founderEmail ?? undefined;

      const text = [
        "Hello,",
        "",
        "Sorry, We cannot proceed with this request at this time, this might affect Madmail\u2019s sending reputation.",
        "",
        "",
        "cheers,",
        "koushik - Madmail.com",
      ].join("\n");

      try {
        await sendMail(
          user.email,
          "Madmail: Waitlist request update",
          text,
          toPlainHtml(text),
          replyTo,
          fromOverride,
        );
      } catch (error) {
        logger.error(
          { userId: user.id, error },
          "Failed to send waitlist rejection email",
        );
        throw new Error("Falha ao enviar o e-mail de rejeição da lista de espera");
      }

      return { sent: true };
    }),

  listTeams: adminProcedure.query(async () => {
    return db.team.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: teamAdminSelection,
    });
  }),

  /**
   * Lista de clientes com a camada financeira: KPIs no topo e, por cliente,
   * total pago e situação de pagamento.
   *
   * Os KPIs são calculados sobre **todos** os times, não sobre a página de 200
   * exibida — senão a taxa de conversão mudaria conforme o tamanho da tabela.
   */
  listCustomers: adminProcedure.query(async () => {
    const [allTeams, rows, cancelamentos] = await Promise.all([
      db.team.findMany({
        select: {
          id: true,
          plan: true,
          planKey: true,
          planProduct: true,
          billingBlockedAt: true,
        },
      }),
      db.team.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: teamAdminSelection,
      }),
      contarCancelamentos(30),
    ]);

    const financials = await loadCustomerFinancials(allTeams);
    const kpis = buildCustomerKpis(allTeams, financials, cancelamentos);

    return {
      kpis,
      /** Quantos times ficaram de fora da tabela por causa do limite de 200. */
      hiddenTeams: Math.max(0, allTeams.length - rows.length),
      teams: rows.map((team) => ({
        ...team,
        finance: financials.get(team.id) ?? null,
      })),
    };
  }),

  findTeam: adminProcedure
    .input(
      z.object({
        query: z
          .string({ required_error: "Search query is required" })
          .trim()
          .min(1, "Search query is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const query = input.query.trim();

      let numericId: number | null = null;
      if (/^\d+$/.test(query)) {
        numericId = Number(query);
      }

      let team = numericId
        ? await db.team.findUnique({
            where: { id: numericId },
            select: teamAdminSelection,
          })
        : null;

      if (!team) {
        team = await db.team.findFirst({
          where: {
            OR: [
              { name: { equals: query, mode: "insensitive" } },
              { billingEmail: { equals: query, mode: "insensitive" } },
              {
                teamUsers: {
                  some: {
                    user: {
                      email: { equals: query, mode: "insensitive" },
                    },
                  },
                },
              },
              {
                domains: {
                  some: {
                    name: { equals: query, mode: "insensitive" },
                  },
                },
              },
              {
                subscription: {
                  some: {
                    id: { equals: query, mode: "insensitive" },
                  },
                },
              },
            ],
          },
          select: teamAdminSelection,
        });
      }

      return team ?? null;
    }),

  updateTeamSettings: adminProcedure
    .input(
      z.object({
        teamId: z.number(),
        apiRateLimit: z.number().int().min(1).max(10_000),
        dailyEmailLimit: z.number().int().min(0).max(10_000_000),
        isBlocked: z.boolean(),
        // O plano agora é a chave do catálogo de preços, não o enum: é ela que
        // vale em todo o sistema depois da unificação.
        planKey: z.string().min(1).max(40),
        planProduct: z.enum(["transactional", "marketing"]).default("transactional"),
      }),
    )
    .mutation(async ({ input }) => {
      const { teamId, planKey, planProduct, ...data } = input;

      await db.team.update({ where: { id: teamId }, data });
      // Troca de plano pela mão do admin passa pelo mesmo caminho do
      // pagamento: um lugar só decide planKey e o espelho do enum.
      await aplicarPlano(teamId, { product: planProduct, key: planKey });

      // Rebaixar para o gratuito pelo admin encerra a assinatura — senão o
      // time apareceria no gratuito com uma cobrança ativa rodando atrás.
      if (planKey === FREE_PLAN_KEY) {
        await downgradeParaGratis(teamId, "admin");
      }

      return db.team.findUniqueOrThrow({
        where: { id: teamId },
        select: teamAdminSelection,
      });
    }),

  /** Planos disponíveis para o seletor do admin — direto da tabela de preços. */
  planOptions: adminProcedure.query(async () => {
    const rows = await db.planCatalogEntry.findMany({
      where: { active: true },
      orderBy: [{ product: "asc" }, { sortOrder: "asc" }],
      select: { product: true, key: true, name: true, priceBRL: true },
    });
    return rows;
  }),

  getEmailAnalytics: adminProcedure
    .input(
      z.object({
        timeframe: z.enum(["today", "thisMonth"]),
        paidOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const timeframe = input.timeframe;
      const paidOnly = input.paidOnly ?? false;

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const monthStartDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const monthStart = monthStartDate.toISOString().slice(0, 10);

      type EmailAnalyticsRow = {
        teamId: number;
        name: string;
        plan: Plan;
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        bounced: number;
        complained: number;
        hardBounced: number;
      };

      const rows = await db.$queryRaw<Array<EmailAnalyticsRow>>`
        SELECT
          d."teamId" AS "teamId",
          t."name" AS name,
          t."plan" AS plan,
          SUM(d.sent)::integer AS sent,
          SUM(d.delivered)::integer AS delivered,
          SUM(d.opened)::integer AS opened,
          SUM(d.clicked)::integer AS clicked,
          SUM(d.bounced)::integer AS bounced,
          SUM(d.complained)::integer AS complained,
          SUM(d."hardBounced")::integer AS "hardBounced"
        FROM "DailyEmailUsage" d
        INNER JOIN "Team" t ON t.id = d."teamId"
        WHERE 1 = 1
        ${
          timeframe === "today"
            ? Prisma.sql`AND d."date" = ${today}`
            : Prisma.sql`AND d."date" >= ${monthStart}`
        }
        ${paidOnly ? Prisma.sql`AND t."plan" = 'BASIC'` : Prisma.sql``}
        GROUP BY d."teamId", t."name", t."plan"
        ORDER BY sent DESC
      `;

      const totals = rows.reduce(
        (acc, row) => {
          acc.sent += row.sent;
          acc.delivered += row.delivered;
          acc.opened += row.opened;
          acc.clicked += row.clicked;
          acc.bounced += row.bounced;
          acc.complained += row.complained;
          acc.hardBounced += row.hardBounced;
          return acc;
        },
        {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          complained: 0,
          hardBounced: 0,
        },
      );

      return {
        rows,
        totals,
        timeframe,
        paidOnly,
        periodStart: timeframe === "today" ? today : monthStart,
      };
    }),

  /**
   * Trilha de auditoria dos eventos criticos de conta. Paginada e filtravel:
   * sem filtro por evento e periodo, a tabela vira um monte de linhas que
   * ninguem consegue investigar.
   */
  listAuditLogs: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        event: z.string().optional(),
        email: z.string().optional(),
        de: z.date().optional(),
        ate: z.date().optional(),
      }),
    )
    .query(async ({ input }) => {
      const porPagina = 50;
      const where = {
        ...(input.event ? { event: input.event } : {}),
        ...(input.email
          ? {
              OR: [
                { targetEmail: { contains: input.email, mode: "insensitive" as const } },
                { actorEmail: { contains: input.email, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(input.de || input.ate
          ? {
              createdAt: {
                ...(input.de ? { gte: input.de } : {}),
                ...(input.ate ? { lte: input.ate } : {}),
              },
            }
          : {}),
      };

      const [logs, total] = await Promise.all([
        db.userAuditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * porPagina,
          take: porPagina,
        }),
        db.userAuditLog.count({ where }),
      ]);

      return { logs, total, porPagina, page: input.page };
    }),

  /** Reset de MFA pelo suporte: pedir, listar e aprovar (two-person rule). */
  solicitarResetDeMfa: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await solicitarResetDeMfa(
        input.userId,
        ctx.session.user.email ?? "suporte",
      );
      return true;
    }),

  listarResetsDeMfa: adminProcedure.query(async () => {
    return db.mfaResetRequest.findMany({
      where: { canceledAt: null, executedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }),

  aprovarResetDeMfa: adminProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await aprovarResetDeMfa(
        input.requestId,
        ctx.session.user.email ?? "suporte",
      );
      return true;
    }),

  listarAdminsDaPlataforma: adminProcedure.query(async () => {
    const usuarios = await db.user.findMany({
      where: { isAdmin: true, deletedAt: null },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { id: "asc" },
    });

    // O dono do ADMIN_EMAIL aparece na lista mesmo sem a coluna marcada: ele é
    // admin de fato, e omiti-lo daria a impressão errada de quem tem acesso.
    const salvaguarda = env.ADMIN_EMAIL
      ? await db.user.findFirst({
          where: { email: env.ADMIN_EMAIL, deletedAt: null },
          select: { id: true, name: true, email: true, createdAt: true },
        })
      : null;

    const porSalvaguarda =
      salvaguarda && !usuarios.some((u) => u.id === salvaguarda.id)
        ? [{ ...salvaguarda, viaEnv: true }]
        : [];

    return [
      ...porSalvaguarda,
      ...usuarios.map((u) => ({
        ...u,
        viaEnv: env.ADMIN_EMAIL
          ? u.email?.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()
          : false,
      })),
    ];
  }),

  promoverAdminDaPlataforma: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const alvo = await db.user.findFirst({
        where: { email: { equals: input.email, mode: "insensitive" } },
        select: { id: true, email: true, isAdmin: true, deletedAt: true },
      });

      if (!alvo || alvo.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Nenhuma conta com este e-mail. A pessoa precisa entrar no Madmail ao menos uma vez antes de virar admin.",
        });
      }

      if (alvo.isAdmin) {
        return true;
      }

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: alvo.id },
          data: { isAdmin: true },
        });
        await registrarAuditoria(
          "platform_admin_granted",
          {
            actorUserId: ctx.session.user.id,
            actorEmail: ctx.session.user.email,
            targetUserId: alvo.id,
            targetEmail: alvo.email,
          },
          tx,
        );
      });

      logger.info(
        { alvo: alvo.email, por: ctx.session.user.email },
        "[Admin]: admin da plataforma concedido",
      );

      return true;
    }),

  removerAdminDaPlataforma: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { pode, motivo } = await podeRemoverAdmin(
        input.userId,
        ctx.session.user.id,
      );

      if (!pode) {
        throw new TRPCError({ code: "FORBIDDEN", message: motivo });
      }

      const alvo = await db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true },
      });

      if (!alvo) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conta não encontrada" });
      }

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: alvo.id },
          data: { isAdmin: false },
        });
        await registrarAuditoria(
          "platform_admin_revoked",
          {
            actorUserId: ctx.session.user.id,
            actorEmail: ctx.session.user.email,
            targetUserId: alvo.id,
            targetEmail: alvo.email,
          },
          tx,
        );
      });

      logger.info(
        { alvo: alvo.email, por: ctx.session.user.email },
        "[Admin]: admin da plataforma removido",
      );

      return true;
    }),
});
