import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  PAYMENT_LOG_CLEANUP_QUEUE,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import {
  purgeOldGatewayLogs,
  getLogRetentionDays,
} from "~/server/billing/gateway-log";

const cleanupQueue = new Queue(PAYMENT_LOG_CLEANUP_QUEUE, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

const worker = new Worker(
  PAYMENT_LOG_CLEANUP_QUEUE,
  async () => {
    const removed = await purgeOldGatewayLogs();
    if (removed > 0) {
      logger.info(
        { removed, retentionDays: getLogRetentionDays() },
        "[PaymentLogCleanup] Logs antigos removidos",
      );
    }
  },
  {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  },
);

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "[PaymentLogCleanup] Job falhou");
});

export async function initPaymentLogCleanupJob() {
  await cleanupQueue.upsertJobScheduler(
    "payment-log-cleanup-tick",
    { pattern: "30 4 * * *", tz: "America/Sao_Paulo" },
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );
  logger.info(
    `[PaymentLogCleanup] Iniciado (diário 04:30 BRT, retenção ${getLogRetentionDays()}d)`,
  );
}
