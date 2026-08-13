import { Queue, Worker } from "bullmq";
import { ReputationState } from "@prisma/client";
import { db } from "~/server/db";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  REPUTATION_EVALUATION_QUEUE,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import { ReputationService } from "../service/reputation-service";
import { ReputationMailer } from "../service/reputation-mailer";
import { sendToDiscord } from "../service/notification-service";

/**
 * Avaliacao periodica do controle de bounce (docs-spec/BOUNCE-CONTROL-SPEC.md §2.7).
 * Roda a cada 10 min sobre times com envio nas ultimas 48h — nunca varre a base
 * inteira.
 */

const TICK_PATTERN = "*/10 * * * *";

/**
 * Circuit breaker: se mais de 2% da base for bloqueada em 24h, o sinal e de
 * regua errada, nao de clientes ruins. A engine para de bloquear ate revisao
 * humana.
 */
const MAX_BLOCK_SHARE_24H = 0.02;

const evaluationQueue = new Queue(REPUTATION_EVALUATION_QUEUE, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

async function circuitBreakerTripped(): Promise<boolean> {
  const since = new Date();
  since.setUTCHours(since.getUTCHours() - 24);

  const [blocked, totalTeams] = await Promise.all([
    db.reputationEvent.count({
      where: {
        toState: ReputationState.BLOCKED,
        actor: "system",
        createdAt: { gte: since },
      },
    }),
    db.team.count(),
  ]);

  if (totalTeams === 0) return false;
  const share = blocked / totalTeams;
  if (share <= MAX_BLOCK_SHARE_24H) return false;

  logger.error(
    { blocked, totalTeams, share },
    "[ReputationJob]: circuit breaker acionado — bloqueios automaticos suspensos",
  );
  await sendToDiscord(
    `⚠️ **Reputação — circuit breaker acionado**\n` +
      `${blocked} times bloqueados nas últimas 24h (${(share * 100).toFixed(1)}% da base). ` +
      `Bloqueios automáticos suspensos até revisão humana da régua.`,
  ).catch(() => undefined);

  return true;
}

const worker = new Worker(
  REPUTATION_EVALUATION_QUEUE,
  async () => {
    const tripped = await circuitBreakerTripped();

    const teamIds = await ReputationService.listRecentlyActiveTeams(48);

    // Times ja bloqueados entram sempre, mesmo sem envio recente: sao eles que
    // precisam ser reavaliados para o desbloqueio e para o lembrete.
    const blockedTeams = await db.teamReputationState.findMany({
      where: {
        state: { in: [ReputationState.BLOCKED, ReputationState.SUPERVISED] },
      },
      select: { teamId: true, state: true },
    });

    const toEvaluate = [
      ...new Set([...teamIds, ...blockedTeams.map((t) => t.teamId)]),
    ];

    logger.info(
      { count: toEvaluate.length, circuitBreaker: tripped },
      "[ReputationJob]: avaliando times",
    );

    for (const teamId of toEvaluate) {
      try {
        await ReputationService.evaluateTeam(teamId, { allowBlock: !tripped });
      } catch (err) {
        logger.error({ err, teamId }, "[ReputationJob]: falha ao avaliar time");
      }
    }

    // Lembretes de quem segue bloqueado (cooldown de 72h, maximo 3).
    for (const team of blockedTeams) {
      if (team.state !== ReputationState.BLOCKED) continue;
      try {
        await ReputationMailer.maybeSendBlockedReminder(team.teamId);
      } catch (err) {
        logger.error(
          { err, teamId: team.teamId },
          "[ReputationJob]: falha ao enviar lembrete",
        );
      }
    }
  },
  {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  },
);

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "[ReputationJob]: Job falhou");
});

export async function initReputationEvaluationJob() {
  await evaluationQueue.upsertJobScheduler(
    "reputation-evaluation-tick",
    { pattern: TICK_PATTERN, tz: "UTC" },
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );
  logger.info("[ReputationJob]: Iniciado (avaliação a cada 10 min)");
}
