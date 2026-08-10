import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  PLATFORM_SYNC_SCHEDULER_QUEUE,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import { db } from "~/server/db";
import { PlatformSyncQueueService } from "~/server/service/platform-sync-queue-service";

const schedulerQueue = new Queue(PLATFORM_SYNC_SCHEDULER_QUEUE, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

const worker = new Worker(
  PLATFORM_SYNC_SCHEDULER_QUEUE,
  async () => {
    const now = Date.now();
    const integrations = await db.platformIntegration.findMany({
      where: { enabled: true },
    });

    for (const integration of integrations) {
      const dueAt = integration.lastSyncedAt
        ? integration.lastSyncedAt.getTime() +
          integration.intervalMinutes * 60 * 1000
        : 0;

      if (now >= dueAt && integration.lastSyncStatus !== "running") {
        await PlatformSyncQueueService.enqueue(
          integration.id,
          integration.teamId,
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
  logger.error({ err, jobId: job?.id }, "[PlatformSyncScheduler] Job falhou");
});

export async function initPlatformSyncScheduler() {
  await schedulerQueue.upsertJobScheduler(
    "platform-sync-tick",
    { pattern: "*/5 * * * *", tz: "UTC" },
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );
  logger.info("[PlatformSyncScheduler] Iniciado (tick 5min)");
}
