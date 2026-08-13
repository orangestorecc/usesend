import { Queue, Worker } from "bullmq";

import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  BILLING_LIFECYCLE_QUEUE,
  DEFAULT_QUEUE_OPTIONS,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import {
  HORAS_ATE_TRAVAR,
  MESES_DE_INATIVIDADE,
  processarContasInativas,
  travarInadimplentes,
} from "~/server/billing/lifecycle-service";

/**
 * Varredura comercial: trava inadimplentes e cuida das contas gratuitas
 * paradas.
 *
 * De hora em hora, não uma vez por dia: a regra é "24 horas depois do
 * vencimento", e um tique diário faria essa promessa variar entre 24 e 48h
 * conforme o horário do vencimento. A parte de inatividade só roda de
 * madrugada — varrer todas as contas gratuitas de hora em hora não muda
 * nenhum resultado.
 */

const fila = new Queue(BILLING_LIFECYCLE_QUEUE, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

const worker = new Worker(
  BILLING_LIFECYCLE_QUEUE,
  async () => {
    await travarInadimplentes();

    const hora = new Date().getHours();
    if (hora === 4) {
      await processarContasInativas();
    }
  },
  {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  },
);

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "[BillingLifecycle] Job falhou");
});

export async function initBillingLifecycleJob() {
  await fila.upsertJobScheduler(
    "billing-lifecycle-tick",
    { pattern: "20 * * * *", tz: "America/Sao_Paulo" },
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );
  logger.info(
    `[BillingLifecycle] Iniciado (de hora em hora; trava ${HORAS_ATE_TRAVAR}h, inatividade ${MESES_DE_INATIVIDADE}m)`,
  );
}
