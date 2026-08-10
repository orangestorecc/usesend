import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  INBOUND_POLL_QUEUE,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import { pollInboundEmails } from "~/server/service/inbound-service";

const pollQueue = new Queue(INBOUND_POLL_QUEUE, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

const worker = new Worker(
  INBOUND_POLL_QUEUE,
  async () => {
    await pollInboundEmails();
  },
  {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  },
);

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "[InboundPoll] Job falhou");
});

export async function initInboundPollJob() {
  await pollQueue.upsertJobScheduler(
    "inbound-poll-tick",
    { pattern: "* * * * *", tz: "UTC" }, // a cada 1 minuto
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );
  logger.info("[InboundPoll] Iniciado (tick 1min)");
}
