/**
 * Sentry no runtime Edge. Hoje o projeto não usa middleware (o roteamento por
 * domínio é feito por rewrite no `next.config.js`), mas o Next carrega este
 * arquivo se alguma rota optar por `runtime = "edge"`.
 */
import * as Sentry from "@sentry/nextjs";

import { ERROS_IGNORADOS, limparEvento } from "~/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_GIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    sendDefaultPii: false,
    maxValueLength: 2000,
    ignoreErrors: ERROS_IGNORADOS,
    beforeSend: limparEvento,
    beforeSendTransaction: limparEvento,
  });
}
