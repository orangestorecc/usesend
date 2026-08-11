/**
 * Sentry no browser.
 *
 * Este é o buraco que o pino não cobria: todo crash de React no dashboard e no
 * editor de email era invisível até aqui.
 *
 * O Next carrega este arquivo automaticamente no client (convenção
 * `instrumentation-client.ts`, Next >= 15.3).
 */
import * as Sentry from "@sentry/nextjs";

import { ERROS_IGNORADOS, limparEvento } from "~/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release:
      process.env.NEXT_PUBLIC_GIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION,

    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0
    ),

    sendDefaultPii: false,
    maxValueLength: 2000,
    ignoreErrors: ERROS_IGNORADOS,

    // Session Replay grava a tela do usuário — com corpo de email e lista de
    // contatos visíveis. Fica desligado.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    beforeSend(evento) {
      return limparEvento(evento);
    },
    beforeBreadcrumb(breadcrumb) {
      // Cliques e digitação carregam o conteúdo do campo; o valor é sempre
      // removido, o alvo do clique fica.
      if (breadcrumb.category === "ui.input") return null;
      return limparEvento(breadcrumb);
    },
  });
}

/** Instrumenta as navegações do App Router. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
