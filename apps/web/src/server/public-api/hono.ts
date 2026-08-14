import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { Context, Next } from "hono";
import { handleError } from "./api-error";
import { env } from "~/env";
import { getRedis, redisKey } from "~/server/redis";
import { getTeamFromToken } from "~/server/public-api/auth";
import { isSelfHosted } from "~/utils/common";
import { UnsendApiError } from "./api-error";
import { Team, ApiKey } from "@prisma/client";
import { logger } from "../logger/log";
import type { McpScopes } from "../service/mcp-key-service";
import { logApiRequest } from "../service/api-log-service";

// Define AppEnv for Hono context
export type AppEnv = {
  Variables: {
    team: Team & {
      apiKeyId: number;
      apiKeyName?: string;
      apiKey: { domainId: number | null };
      mcpScopes?: McpScopes;
    };
  };
};

// Escopo exigido por (método, caminho) para tokens MCP. Retorna true se permitido.
export function mcpScopeAllows(
  method: string,
  path: string,
  scopes: McpScopes,
): boolean {
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
  const levelOk = (val: string, needWrite: boolean) =>
    needWrite ? val === "write" : val === "read" || val === "write";

  if (path.includes("/v1/mcp")) return true; // /v1/mcp/me
  if (path.includes("/v1/analytics")) return scopes.analytics === "read";
  if (path.includes("/v1/templates")) return levelOk(scopes.templates, isWrite);
  if (path.includes("/v1/segments")) return levelOk(scopes.segments, isWrite);
  if (path.includes("/v1/campaigns")) {
    if (/\/(schedule|resume)/.test(path)) return scopes.send === true; // disparo
    return levelOk(scopes.campaigns, isWrite);
  }
  if (path.includes("/v1/emails")) {
    // Cancelar é contenção de dano: quem pausa uma campanha também precisa
    // conseguir cancelar um agendamento, sem depender do escopo de disparo.
    if (path.includes("/cancel")) return levelOk(scopes.campaigns, true);
    if (isWrite) return scopes.send === true; // enviar transacional
    // Leitura devolve destinatário, assunto e corpo — é PII, não metadado.
    return levelOk(scopes.campaigns, false);
  }
  if (path.includes("/v1/contactBooks")) {
    const cap = path.includes("/contacts") ? scopes.contacts : scopes.lists;
    return levelOk(cap, isWrite);
  }
  if (path.includes("/v1/domains")) return !isWrite; // cliente MCP: domínios só leitura
  if (path.includes("/v1/reputation")) return scopes.reputation === "read";
  // Disparar um evento aciona automações, que mandam e-mail de verdade.
  if (path.includes("/v1/events")) return scopes.send === true;

  // Negar por padrão: rota /v1 nova nasce fechada para token MCP até ganhar
  // uma regra aqui. O contrário já custou caro (reputação ficou aberta).
  if (path.includes("/v1/")) {
    logger.warn({ method, path }, "Rota /v1 sem regra de escopo MCP — negada");
    return false;
  }
  return true;
}

export function getApp() {
  const app = new OpenAPIHono<AppEnv>().basePath("/api");

  app.onError(handleError);

  // Log de requisições (wrapper externo — captura status final e duração).
  app.use("*", async (c: Context<AppEnv>, next: Next) => {
    const start = Date.now();
    await next();
    const path = c.req.path;
    if (
      !path.startsWith("/api/v1") ||
      path.startsWith("/api/v1/doc") ||
      path.startsWith("/api/v1/ui")
    ) {
      return;
    }
    const team = c.var.team;
    logApiRequest({
      teamId: team?.id,
      apiKeyId: team?.apiKeyId,
      apiKeyName: team?.apiKeyName,
      method: c.req.method,
      path,
      statusCode: c.res.status,
      userAgent: c.req.header("User-Agent"),
      isMcp: Boolean(team?.mcpScopes),
      durationMs: Date.now() - start,
    });
  });

  // Auth and Team Middleware (runs before rate limiter)
  app.use("*", async (c: Context<AppEnv>, next: Next) => {
    if (
      c.req.path.startsWith("/api/v1/doc") ||
      c.req.path.startsWith("/api/v1/ui") ||
      c.req.path === "/api/health"
    ) {
      return next();
    }

    try {
      const team = await getTeamFromToken(c as any);
      c.set("team", team);
    } catch (error) {
      if (error instanceof UnsendApiError) {
        throw error;
      }
      logger.error({ err: error }, "Error in getTeamFromToken middleware");
      throw new UnsendApiError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Falha na autenticação",
      });
    }
    await next();
  });

  // Enforcement de escopo para tokens MCP (msk_)
  app.use("*", async (c: Context<AppEnv>, next: Next) => {
    const scopes = c.var.team?.mcpScopes;
    if (scopes && !mcpScopeAllows(c.req.method, c.req.path, scopes)) {
      throw new UnsendApiError({
        code: "FORBIDDEN",
        message: "MCP token não tem permissão (escopo) para esta operação",
      });
    }
    await next();
  });

  // Custom Rate Limiter Middleware
  const RATE_LIMIT_WINDOW_SECONDS = 1;

  app.use("*", async (c: Context<AppEnv>, next: Next) => {
    // Skip for self-hosted, or if team is not set (e.g. for public/doc paths not caught earlier)
    // or if the path is one of the explicitly skipped paths for auth.
    if (
      isSelfHosted() ||
      !c.var.team || // Team should be set by auth middleware for protected routes
      c.req.path.startsWith("/api/v1/doc") ||
      c.req.path.startsWith("/api/v1/ui") ||
      c.req.path === "/api/health"
    ) {
      return next();
    }

    const team = c.var.team;
    const limit = team.apiRateLimit ?? 2; // Default limit from your previous setup
    const key = redisKey(`rl:${team.id}`); // Rate limit key for Redis
    const redis = getRedis();

    let currentRequests: number;
    let ttl: number;

    try {
      // Increment the key. If the key does not exist, it is created and set to 1.
      currentRequests = await redis.incr(key);

      if (currentRequests === 1) {
        // This is the first request in the window, set the expiry.
        await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
      }
      // Get the TTL (time to live) of the key to know when it resets.
      // If the key does not exist or has no expiry, TTL returns -1 or -2.
      // We rely on expire being set for new keys.
      ttl = await redis.ttl(key);
    } catch (error) {
      logger.error({ err: error }, "Redis error during rate limiting");
      // Alternatively, you could fail closed by throwing an error here.
      return next();
    }

    const resetTime =
      Math.floor(Date.now() / 1000) +
      (ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS);
    const remainingRequests = Math.max(0, limit - currentRequests);

    c.res.headers.set("X-RateLimit-Limit", String(limit));
    c.res.headers.set("X-RateLimit-Remaining", String(remainingRequests));
    c.res.headers.set("X-RateLimit-Reset", String(resetTime));

    if (currentRequests > limit) {
      c.res.headers.set(
        "Retry-After",
        String(ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS)
      );
      throw new UnsendApiError({
        code: "RATE_LIMITED",
        message: `Limite de requisições excedido. Tente novamente em ${ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS} segundos.`,
      });
    }

    await next();
  });

  // The OpenAPI documentation will be available at /doc
  app.doc("/v1/doc", (c) => ({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Madmail API",
    },
    servers: [{ url: `${env.NEXTAUTH_URL}/api` }],
  }));

  app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
    type: "http",
    scheme: "bearer",
  });

  app.get("/v1/ui", swaggerUI({ url: "/api/v1/doc" }));

  return app;
}

export type PublicAPIApp = OpenAPIHono<AppEnv>;
