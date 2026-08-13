import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  ACCOUNT_LIFECYCLE_QUEUE,
  DEFAULT_QUEUE_OPTIONS,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import { db } from "~/server/db";
import {
  AUDIT_RETENCAO_MESES,
  purgarAuditoriaAntiga,
} from "~/server/service/audit-service";
import {
  DIAS_ATE_HARD_DELETE,
  purgarContasExcluidas,
} from "~/server/service/account-deletion-service";
import { executarResetsVencidos } from "~/server/service/mfa-reset-service";
import { purgarArquivosDeImportacaoAntigos } from "~/server/service/contact-import-service";

const fila = new Queue(ACCOUNT_LIFECYCLE_QUEUE, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

const worker = new Worker(
  ACCOUNT_LIFECYCLE_QUEUE,
  async () => {
    const contas = await purgarContasExcluidas();
    const logs = await purgarAuditoriaAntiga();

    // Códigos expirados e desafios vencidos não têm valor nenhum depois do
    // prazo — deixá-los acumulando só engorda a tabela.
    const { count: codigos } = await db.securityCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const { count: desafios } = await db.mfaChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // Reset de MFA só executa aqui: rodar na aprovação anularia as 72h.
    const resets = await executarResetsVencidos();

    // Retenção de 90 dias dos arquivos de importação (dados pessoais de
    // terceiros): bloquear o download não bastava, o objeto sai do bucket.
    const arquivos = await purgarArquivosDeImportacaoAntigos();

    if (contas || logs || codigos || desafios || resets || arquivos) {
      logger.info(
        { contas, logs, codigos, desafios, resets, arquivos },
        "[AccountLifecycle] Limpeza concluída",
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
  logger.error({ err, jobId: job?.id }, "[AccountLifecycle] Job falhou");
});

export async function initAccountLifecycleJob() {
  await fila.upsertJobScheduler(
    "account-lifecycle-tick",
    { pattern: "15 3 * * *", tz: "America/Sao_Paulo" },
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );
  logger.info(
    `[AccountLifecycle] Iniciado (diário 03:15 BRT; contas ${DIAS_ATE_HARD_DELETE}d, auditoria ${AUDIT_RETENCAO_MESES}m)`,
  );
}
