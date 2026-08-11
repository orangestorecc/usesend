import * as Sentry from "@sentry/nextjs";
import type { LogFn } from "pino";

import { limparEvento, mascararEmails } from "~/lib/sentry-scrub";

/**
 * Faz `logger.error(...)` e `logger.fatal(...)` chegarem ao Sentry sem exigir
 * um `captureException` manual em cada `catch` espalhado pelo código.
 *
 * A ideia é ter um ponto único: o pino continua sendo a fonte de verdade dos
 * logs e o Sentry recebe só o que já foi classificado como erro. Nível
 * `warn` para baixo fica de fora de propósito — warning em produção é comum e
 * encheria a cota sem apontar defeito.
 */

const NIVEL_ERROR = 50;
const NIVEL_FATAL = 60;

/** Separa o `Error` do resto quando o pino é chamado no formato `({ err }, msg)`. */
function extrair(args: unknown[]): {
  erro?: Error;
  mensagem?: string;
  extra?: Record<string, unknown>;
} {
  const [primeiro, segundo] = args;

  if (primeiro instanceof Error) {
    return {
      erro: primeiro,
      mensagem: typeof segundo === "string" ? segundo : undefined,
    };
  }

  if (primeiro && typeof primeiro === "object") {
    const objeto = primeiro as Record<string, unknown>;
    const candidato = objeto.err ?? objeto.error;
    return {
      erro: candidato instanceof Error ? candidato : undefined,
      mensagem: typeof segundo === "string" ? segundo : undefined,
      extra: objeto,
    };
  }

  return { mensagem: typeof primeiro === "string" ? primeiro : undefined };
}

/**
 * Hook do pino instalado no logger raiz. Vale automaticamente para todo child
 * logger criado por `getChildLogger`, então o `teamId` / `requestId` do request
 * viaja junto para o Sentry.
 */
export function logMethodComSentry(
  this: { bindings: () => Record<string, unknown> },
  args: Parameters<LogFn>,
  method: LogFn,
  level: number
) {
  if (level >= NIVEL_ERROR) {
    try {
      const { erro, mensagem, extra } = extrair(args as unknown[]);
      const bindings = this.bindings?.() ?? {};

      Sentry.withScope((scope) => {
        scope.setLevel(level >= NIVEL_FATAL ? "fatal" : "error");

        // `teamId` vira tag para dar filtro por cliente na interface do
        // Sentry; o resto do binding fica como contexto.
        if (bindings.teamId != null) scope.setTag("teamId", String(bindings.teamId));
        if (bindings.requestId != null) scope.setTag("requestId", String(bindings.requestId));
        scope.setContext("logger", limparEvento(bindings));

        if (extra) scope.setContext("log", limparEvento(extra));

        if (erro) {
          if (mensagem) scope.setTag("logMessage", mascararEmails(mensagem).slice(0, 200));
          Sentry.captureException(erro);
        } else if (mensagem) {
          Sentry.captureMessage(mascararEmails(mensagem));
        }
      });
    } catch {
      // Telemetria nunca pode derrubar o log. Se o Sentry falhar, o pino
      // segue normalmente logo abaixo.
    }
  }

  return method.apply(this, args);
}
