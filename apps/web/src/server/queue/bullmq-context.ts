import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { getChildLogger, withLogger } from "../logger/log";
import { Job } from "bullmq";

export type TeamJob<T> = Job<T & { teamId?: number }>;

/**
 * Simple wrapper function for BullMQ worker jobs with team context
 *
 * Também é o ponto único de captura de falha de job. Antes, um envio que
 * estourasse aqui só aparecia como log no stdout do processo e o BullMQ
 * seguia para o retry — ninguém ficava sabendo. Como todos os workers do app
 * passam por este wrapper, reportar aqui cobre envio, campanha, contato,
 * webhook e sincronização de uma vez.
 */
export function createWorkerHandler<T>(
  handler: (job: TeamJob<T>) => Promise<void>
) {
  return async (job: TeamJob<T>) => {
    const queueId = job.id ?? randomUUID();

    return await withLogger(
      getChildLogger({
        teamId: job.data.teamId,
        queueId,
      }),
      async () => {
        try {
          return await handler(job);
        } catch (erro) {
          Sentry.withScope((scope) => {
            scope.setTag("queue", job.queueName);
            scope.setTag("job.name", job.name);
            if (job.data.teamId != null) {
              scope.setTag("teamId", String(job.data.teamId));
            }
            scope.setContext("job", {
              id: queueId,
              // Quantas tentativas já falharam: distingue instabilidade
              // passageira de job que nunca vai passar.
              tentativa: job.attemptsMade,
              tentativasMax: job.opts?.attempts,
            });
            // Só o retry final é defeito de verdade; os intermediários viram
            // apenas aviso para não duplicar o mesmo problema no painel.
            const ultimaTentativa =
              !job.opts?.attempts || job.attemptsMade + 1 >= job.opts.attempts;
            scope.setLevel(ultimaTentativa ? "error" : "warning");
            Sentry.captureException(erro);
          });

          // Rethrow: o BullMQ precisa ver a falha para agendar o retry.
          throw erro;
        }
      }
    );
  };
}
