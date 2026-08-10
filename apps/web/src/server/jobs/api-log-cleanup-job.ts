import { Queue, Worker } from "bullmq";
import { subDays } from "date-fns";
import { db } from "~/server/db";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  API_LOG_CLEANUP_QUEUE,
} from "../queue/queue-constants";
import { logger } from "../logger/log";

const API_LOG_RETENTION_DAYS = 30;

const cleanupQueue = new Queue(API_LOG_CLEANUP_QUEUE, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

const worker = new Worker(
  API_LOG_CLEANUP_QUEUE,
  async () => {
    const cutoff = subDays(new Date(), API_LOG_RETENTION_DAYS);
    const result = await db.apiRequestLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    logger.info(
      { deleted: result.count, cutoff: cutoff.toISOString() },
      "[ApiLogCleanupJob]: Removidos logs antigos",
    );
  },
  {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  },
);

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "[ApiLogCleanupJob]: Job falhou");
});

export async function initApiLogCleanupJob() {
  await cleanupQueue.upsertJobScheduler(
    "api-log-cleanup-daily",
    { pattern: "0 4 * * *", tz: "UTC" },
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );
  logger.info("[ApiLogCleanupJob]: Iniciado (retenção 30 dias)");
}
