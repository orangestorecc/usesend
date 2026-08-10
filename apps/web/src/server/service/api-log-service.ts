import { db } from "../db";
import { logger } from "../logger/log";

// Fontes/agentes REALMENTE detectáveis hoje (filtro restrito, honesto).
export const LOG_SOURCES = ["mcp", "go", "curl", "http"] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

export const LOG_SOURCE_LABELS: Record<LogSource, string> = {
  mcp: "MCP",
  go: "Go",
  curl: "cURL",
  http: "HTTP / Outro",
};

export function detectSource(
  userAgent: string | undefined,
  isMcp: boolean,
): LogSource {
  if (isMcp) return "mcp";
  const ua = (userAgent ?? "").toLowerCase();
  if (ua.includes("usesend-go")) return "go";
  if (ua.includes("curl")) return "curl";
  return "http";
}

// "/api/v1/emails/abc123def..." -> "/emails/:id"
export function normalizeEndpoint(path: string): string {
  let p = path.replace(/^\/api\/v1/, "").replace(/^\/api/, "");
  if (!p) return "/";
  p = p
    .split("/")
    .map((seg) =>
      /^(c[a-z0-9]{20,}|[0-9]+|[0-9a-f]{16,}|[0-9a-fA-F-]{20,})$/.test(seg)
        ? ":id"
        : seg,
    )
    .join("/");
  return p || "/";
}

// Grava o log de forma assíncrona (fire-and-forget) para não bloquear a resposta.
export function logApiRequest(data: {
  teamId?: number;
  apiKeyId?: number;
  apiKeyName?: string | null;
  method: string;
  path: string;
  statusCode: number;
  userAgent?: string;
  isMcp: boolean;
  durationMs: number;
}) {
  // Sem time (token inválido) não há como atribuir a requisição — não loga.
  if (data.teamId === undefined) return;

  const source = detectSource(data.userAgent, data.isMcp);

  db.apiRequestLog
    .create({
      data: {
        teamId: data.teamId,
        apiKeyId: data.apiKeyId && data.apiKeyId > 0 ? data.apiKeyId : null,
        apiKeyName: data.apiKeyName ?? null,
        method: data.method,
        endpoint: normalizeEndpoint(data.path),
        path: data.path,
        statusCode: data.statusCode,
        source,
        userAgent: data.userAgent?.slice(0, 300) ?? null,
        durationMs: data.durationMs,
      },
    })
    .catch((err) =>
      logger.error({ err }, "[ApiLog] Falha ao gravar log de requisição"),
    );
}
