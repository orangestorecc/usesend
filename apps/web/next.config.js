/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

import { withSentryConfig } from "@sentry/nextjs";

/** @type {import("next").NextConfig} */
const config = {
  output: process.env.DOCKER_OUTPUT ? "standalone" : undefined,
  serverExternalPackages: ["bullmq"],
  transpilePackages: ["@usesend/ui", "@usesend/email-editor"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.gravatar.com",
      },
    ],
  },

  /**
   * Roteamento por domínio.
   *
   * O proxy reverso da infra manda `app.` e `www.` para a mesma porta, então a
   * separação acontece aqui: requisição chegando por um domínio do site
   * institucional é reescrita para o servidor estático que serve o export de
   * `apps/marketing`, e o mesmo vale para a documentação (`apps/docs`,
   * exportada em estático pelo `mint export`).
   *
   * Feito por rewrite (Node) e não por middleware (Edge) de propósito: o
   * bundle de middleware quebrava a etapa de minificação do build.
   *
   * Sem as variáveis de origem e hosts definidas, nada muda.
   */
  async rewrites() {
    const regras = [];

    const porHost = (origin, hostsRaw) => {
      const hosts = (hostsRaw ?? "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean);
      if (!origin || hosts.length === 0) return;
      for (const host of hosts) {
        regras.push({
          source: "/:path*",
          has: [{ type: "host", value: host }],
          destination: `${origin}/:path*`,
        });
      }
    };

    porHost(process.env.MARKETING_ORIGIN, process.env.MARKETING_HOSTS);
    porHost(process.env.DOCS_ORIGIN, process.env.DOCS_HOSTS);

    return regras.length ? { beforeFiles: regras } : [];
  },
};

/**
 * O plugin do Sentry injeta a instrumentação no build e, quando há
 * `SENTRY_AUTH_TOKEN`, sobe os sourcemaps para que o stack trace em produção
 * apareça legível em vez de minificado.
 *
 * Sem DSN configurado o wrapper é inócuo, então o build de quem roda self-host
 * sem Sentry segue idêntico.
 */
const uploadSourcemaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,
  telemetry: false,

  sourcemaps: {
    disable: !uploadSourcemaps,
    // Sourcemap publicado deixa o código-fonte do app aberto no browser.
    deleteSourcemapsAfterUpload: true,
  },

  // Faz o tunelamento dos eventos do browser por uma rota do próprio app, para
  // que bloqueador de anúncio não engula o relatório de erro.
  tunnelRoute: "/monitoring",

  // Corta o SDK de erro do lado do cliente pela metade removendo o código de
  // debug, que só serve em desenvolvimento.
  disableLogger: true,

  webpack: {
    // O `register()` de `instrumentation.ts` roda em toda inicialização; o
    // Sentry não precisa instrumentar de novo o startup do Vercel Cron.
    automaticVercelMonitors: false,
  },
});
