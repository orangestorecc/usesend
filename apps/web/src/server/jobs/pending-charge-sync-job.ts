import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  PENDING_CHARGE_SYNC_QUEUE,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import { db } from "~/server/db";
import { sincronizarCobrancaPendente } from "~/server/billing/payment-service";

/**
 * Varre cobranças PIX pendentes e pergunta ao Inter se já foram pagas.
 *
 * Duas camadas já cuidam do caso normal: o webhook do banco e a consulta que o
 * checkout dispara enquanto o cliente olha o QR. Nenhuma das duas cobre quem
 * paga depois de fechar a aba com o webhook fora do ar — e foi assim que um
 * pagamento real ficou preso em "pendente", com o dinheiro já na conta.
 *
 * Dinheiro recebido e plano não ativado é o pior erro possível aqui, então vale
 * a checagem periódica mesmo sendo redundante na maior parte das vezes.
 */

/** Cobranças mais velhas que isso não são mais consultadas. */
const JANELA_HORAS = 48;

/** Teto por rodada, para não varrer a base inteira se algo se acumular. */
const MAX_POR_RODADA = 50;

const syncQueue = new Queue(PENDING_CHARGE_SYNC_QUEUE, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

export async function sincronizarPendentes(): Promise<number> {
  const desde = new Date(Date.now() - JANELA_HORAS * 60 * 60 * 1000);
  const pendentes = await db.charge.findMany({
    where: {
      status: "pending",
      method: "pix",
      providerChargeId: { not: null },
      createdAt: { gte: desde },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_POR_RODADA,
    select: { id: true },
  });

  let confirmadas = 0;
  for (const charge of pendentes) {
    // Sequencial de propósito: são poucas e cada uma é uma chamada ao Inter
    // com mTLS. Rajada só renderia rate limit.
    if (await sincronizarCobrancaPendente(charge.id)) confirmadas++;
  }

  if (confirmadas > 0) {
    logger.info(
      { confirmadas, verificadas: pendentes.length },
      "[PendingChargeSync] Cobranças confirmadas fora do webhook",
    );
  }
  return confirmadas;
}

const worker = new Worker(
  PENDING_CHARGE_SYNC_QUEUE,
  async () => {
    await sincronizarPendentes();
  },
  {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  },
);

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "[PendingChargeSync] Job falhou");
});

export async function initPendingChargeSyncJob() {
  await syncQueue.upsertJobScheduler(
    "pending-charge-sync-tick",
    { every: 5 * 60 * 1000 },
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );
  logger.info("[PendingChargeSync] Iniciado (tick 5min)");
}
