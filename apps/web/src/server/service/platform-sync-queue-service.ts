import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "../redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  PLATFORM_SYNC_QUEUE,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import { createWorkerHandler, TeamJob } from "../queue/bullmq-context";
import { db } from "../db";
import { decryptSecret } from "../crypto";
import { ContactQueueService } from "./contact-queue-service";
import {
  fetchCustomersPage,
  mapCustomer,
  type SubscribeMode,
} from "./platform/orangestore";

type PlatformSyncJobData = {
  integrationId: string;
  teamId?: number;
};

type PlatformSyncJob = TeamJob<PlatformSyncJobData>;

const PAGE_SIZE = 100;
const MAX_PAGES = 1000; // trava de segurança

class PlatformSyncQueueService {
  public static queue = new Queue<PlatformSyncJobData>(PLATFORM_SYNC_QUEUE, {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
    defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
  });

  public static worker = new Worker(
    PLATFORM_SYNC_QUEUE,
    createWorkerHandler(processSyncJob),
    {
      connection: getRedis(),
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
      concurrency: 2,
    },
  );

  static {
    this.worker.on("error", (err) => {
      logger.error({ err }, "[PlatformSyncQueueService]: Worker error");
    });
    logger.info("[PlatformSyncQueueService]: Initialized");
  }

  public static async enqueue(integrationId: string, teamId?: number) {
    await this.queue.add(
      `sync-${integrationId}`,
      { integrationId, teamId },
      { ...DEFAULT_QUEUE_OPTIONS, jobId: `sync-${integrationId}` },
    );
  }
}

async function processSyncJob(job: PlatformSyncJob) {
  const { integrationId } = job.data;

  const integration = await db.platformIntegration.findUnique({
    where: { id: integrationId },
  });
  if (!integration || !integration.enabled) {
    return;
  }

  const startedAt = new Date();
  await db.platformIntegration.update({
    where: { id: integrationId },
    data: { lastSyncStatus: "running", lastSyncError: null },
  });

  try {
    const apiKey = decryptSecret(integration.apiKeyEnc);
    const modifiedAfter = integration.cursorModifiedAt ?? undefined;
    let page = 1;
    let total = 0;
    let ignorados = 0;

    while (page <= MAX_PAGES) {
      const customers = await fetchCustomersPage({
        baseUrl: integration.baseUrl,
        apiKey,
        limit: PAGE_SIZE,
        page,
        modifiedAfter,
      });
      if (customers.length === 0) break;

      const mapeados = customers.map((c) =>
        mapCustomer(c, integration.subscribeMode as SubscribeMode),
      );
      const contacts = mapeados.filter(
        (c): c is NonNullable<typeof c> => c !== null,
      );
      // Sem e-mail válido não dá para virar contato — conta para o histórico.
      ignorados += mapeados.length - contacts.length;

      if (contacts.length > 0) {
        await ContactQueueService.addBulkContactJobs(
          integration.contactBookId,
          contacts,
          integration.teamId,
        );
        total += contacts.length;
      }

      if (customers.length < PAGE_SIZE) break;
      page += 1;
    }

    await db.platformIntegration.update({
      where: { id: integrationId },
      data: {
        lastSyncedAt: new Date(),
        cursorModifiedAt: startedAt,
        lastSyncStatus: "ok",
        lastSyncCount: total,
        lastSyncError: null,
      },
    });

    await registrarRodada({
      integrationId,
      teamId: integration.teamId,
      status: "ok",
      total,
      ignorados,
      startedAt,
    });

    logger.info(
      { integrationId, teamId: integration.teamId, total },
      "[PlatformSyncQueueService]: Sync concluído",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.platformIntegration.update({
      where: { id: integrationId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: "error",
        lastSyncError: message.slice(0, 500),
      },
    });
    await registrarRodada({
      integrationId,
      teamId: integration.teamId,
      status: "error",
      total: 0,
      ignorados: 0,
      startedAt,
      erro: message,
    });

    logger.error(
      { integrationId, error },
      "[PlatformSyncQueueService]: Falha no sync",
    );
    throw error;
  }
}

/**
 * Grava a rodada no histórico. Nunca lança: o registro é para auditoria, e
 * falhar aqui não pode desfazer uma sincronização que deu certo.
 */
async function registrarRodada(dados: {
  integrationId: string;
  teamId: number;
  status: "ok" | "error";
  total: number;
  ignorados: number;
  startedAt: Date;
  erro?: string;
}) {
  try {
    const fim = new Date();
    await db.platformSyncRun.create({
      data: {
        integrationId: dados.integrationId,
        teamId: dados.teamId,
        status: dados.status,
        // A importação é assíncrona (fila de contatos), então aqui sabemos
        // quantos foram enviados, não quantos eram novos de fato.
        created: dados.total,
        updated: 0,
        skipped: dados.ignorados,
        error: dados.erro?.slice(0, 500),
        durationMs: fim.getTime() - dados.startedAt.getTime(),
        startedAt: dados.startedAt,
        finishedAt: fim,
      },
    });
  } catch (err) {
    logger.error({ err }, "[PlatformSyncQueueService]: Falha ao gravar histórico");
  }
}

export { PlatformSyncQueueService };
