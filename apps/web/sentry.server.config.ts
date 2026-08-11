/**
 * Sentry no runtime Node do Next (route handlers, server actions, RSC, jobs).
 *
 * Carregado por `src/instrumentation.ts`. Sem `SENTRY_DSN` definido nada é
 * inicializado, então self-host sem conta Sentry continua funcionando igual.
 */
import * as Sentry from "@sentry/nextjs";

import { ERROS_IGNORADOS, limparEvento } from "~/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_GIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION,

    // Queremos erros, não APM. Tracing fica em 0 por padrão para não estourar
    // a cota do plano free com transação de rota.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),

    // A base tem endereço de contato em quase toda tabela: nunca enviar dado
    // de usuário por conta própria.
    sendDefaultPii: false,
    maxValueLength: 2000,

    ignoreErrors: ERROS_IGNORADOS,

    // O pino já é a fonte de verdade dos logs; deixar o Sentry capturar
    // console duplicaria tudo.
    integrations: (padrao) =>
      padrao.filter(
        (integracao) =>
          integracao.name !== "Console" && integracao.name !== "LocalVariables"
      ),

    beforeSend(evento) {
      return limparEvento(evento);
    },
    beforeSendTransaction(evento) {
      return limparEvento(evento);
    },
    beforeBreadcrumb(breadcrumb) {
      // Query de banco vaza email dentro do SQL; a categoria não vale o risco.
      if (breadcrumb.category?.startsWith("db")) return null;
      return limparEvento(breadcrumb);
    },
  });
}
