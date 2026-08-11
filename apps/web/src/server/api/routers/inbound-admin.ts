import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { env } from "~/env";
import { pollInboundEmails } from "~/server/service/inbound-service";
import { logger } from "~/server/logger/log";

/**
 * Diagnóstico do recebimento de e-mail.
 *
 * Existe porque hoje não há como saber se o recebimento está funcionando sem
 * entrar no servidor: se INBOUND_S3_BUCKET não estiver definida, o job de
 * polling simplesmente não inicia — em silêncio.
 */
export const inboundAdminRouter = createTRPCRouter({
  status: adminProcedure.query(async () => {
    const bucket = env.INBOUND_S3_BUCKET;
    const region = env.INBOUND_S3_REGION;
    const hasRedis = Boolean(process.env.REDIS_URL);
    const hasAws = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);

    // O job só é registrado no boot, e só quando as duas condições valem.
    const jobAtivo = Boolean(bucket) && hasRedis;

    const [total, ultimo, dominios] = await Promise.all([
      db.inboundEmail.count(),
      db.inboundEmail.findFirst({
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true, fromEmail: true, subject: true },
      }),
      db.domain.findMany({
        where: { receivingEnabled: true },
        select: { id: true, name: true, teamId: true, status: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const desde24h = await db.inboundEmail.count({
      where: { receivedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    return {
      bucket: bucket ?? null,
      region,
      hasRedis,
      hasAws,
      jobAtivo,
      total,
      desde24h,
      ultimo,
      dominios,
      // Inbound do SES existe só em us-east-1; deixar explícito evita a
      // pergunta recorrente de "por que não funciona na minha região".
      regiaoCorreta: region === "us-east-1",
    };
  }),

  /** Roda um ciclo de polling na hora, sem esperar o próximo minuto. */
  pollAgora: adminProcedure.mutation(async () => {
    if (!env.INBOUND_S3_BUCKET) {
      throw new Error(
        "INBOUND_S3_BUCKET não está definida — o recebimento está desligado.",
      );
    }
    const antes = await db.inboundEmail.count();
    try {
      await pollInboundEmails();
    } catch (err) {
      logger.error({ err }, "[InboundAdmin] Falha ao rodar o polling manual");
      throw new Error(
        err instanceof Error ? err.message : "Falha ao consultar o S3.",
      );
    }
    const depois = await db.inboundEmail.count();
    return { novos: depois - antes, total: depois };
  }),

  /** Últimos e-mails recebidos, de todos os times. */
  recentes: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const emails = await db.inboundEmail.findMany({
        orderBy: { receivedAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          teamId: true,
          fromEmail: true,
          to: true,
          subject: true,
          receivedAt: true,
        },
      });

      const teamIds = [...new Set(emails.map((e) => e.teamId))];
      const teams = await db.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true },
      });
      const nome = new Map(teams.map((t) => [t.id, t.name]));

      return emails.map((e) => ({
        ...e,
        teamName: nome.get(e.teamId) ?? `Time #${e.teamId}`,
      }));
    }),
});
