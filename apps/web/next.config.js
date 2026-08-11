/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

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
   * `apps/marketing`.
   *
   * Feito por rewrite (Node) e não por middleware (Edge) de propósito: o
   * bundle de middleware quebrava a etapa de minificação do build.
   *
   * Sem MARKETING_ORIGIN e MARKETING_HOSTS definidos, nada muda.
   */
  async rewrites() {
    const origin = process.env.MARKETING_ORIGIN;
    const hosts = (process.env.MARKETING_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);

    if (!origin || hosts.length === 0) return [];

    return {
      beforeFiles: hosts.map((host) => ({
        source: "/:path*",
        has: [{ type: "host", value: host }],
        destination: `${origin}/:path*`,
      })),
    };
  },
};

export default config;
