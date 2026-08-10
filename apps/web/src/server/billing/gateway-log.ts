import { db } from "~/server/db";
import { logger } from "~/server/logger/log";

/**
 * Log das chamadas aos gateways de pagamento (saída) e dos webhooks recebidos.
 *
 * IMPORTANTE: nada sensível é persistido. Números de cartão, CVV, chave
 * privada, client_secret e tokens de acesso são redigidos antes de gravar.
 */

/** Retenção em dias (mínimo 30, exigência do negócio). */
export function getLogRetentionDays(): number {
  const raw = Number(process.env.PAYMENT_LOG_RETENTION_DAYS ?? 90);
  if (!Number.isFinite(raw)) return 90;
  return Math.max(30, Math.floor(raw));
}

/** Chaves cujo valor nunca deve ser gravado. */
const SENSITIVE_KEYS = [
  "cardnumber",
  "card_number",
  "number",
  "securitycode",
  "security_code",
  "cvv",
  "cvc",
  "privatekey",
  "private_key",
  "certificate",
  "client_secret",
  "clientsecret",
  "access_token",
  "authorization",
  "x-api-key",
  "password",
  "token",
  "cardtoken",
  "card_token",
];

function maskValue(key: string, value: string): string {
  const k = key.toLowerCase();
  // Cartão/token: preserva os 4 últimos para rastreabilidade.
  if (k.includes("card") || k === "number" || k.includes("token")) {
    const tail = value.slice(-4);
    return value.length > 4 ? `••••${tail}` : "••••";
  }
  return "[REDACTED]";
}

/** Redige recursivamente qualquer campo sensível de um objeto/array. */
export function redact(input: unknown, depth = 0): unknown {
  if (depth > 8) return "[deep]";
  if (input === null || input === undefined) return input;

  if (typeof input === "string") {
    // Corpos PEM inteiros (certificado/chave) nunca vão pro log.
    if (input.includes("-----BEGIN")) return "[PEM REDACTED]";
    // Sequências longas de dígitos parecem PAN — mascara.
    return input.replace(/\b\d{13,19}\b/g, (m) => `••••${m.slice(-4)}`);
  }

  if (Array.isArray(input)) return input.map((v) => redact(v, depth + 1));

  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        out[key] =
          typeof value === "string" ? maskValue(key, value) : "[REDACTED]";
      } else {
        out[key] = redact(value, depth + 1);
      }
    }
    return out;
  }

  return input;
}

/** Converte um corpo cru (string/objeto) em JSON seguro pro log. */
function toJson(body: unknown): unknown {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") {
    if (!body.trim()) return undefined;
    try {
      return redact(JSON.parse(body));
    } catch {
      return redact(body.slice(0, 4000));
    }
  }
  return redact(body);
}

export type GatewayLogEntry = {
  provider: "inter" | "rede";
  direction: "outbound" | "inbound";
  method: string;
  url: string;
  operation?: string;
  requestHeaders?: Record<string, unknown>;
  requestBody?: unknown;
  responseStatus?: number;
  responseBody?: unknown;
  durationMs?: number;
  success?: boolean;
  error?: string;
  chargeId?: string;
  teamId?: number;
};

/**
 * Grava uma entrada de log. Nunca lança — falha de log não pode derrubar um
 * pagamento.
 */
export async function logGatewayCall(entry: GatewayLogEntry): Promise<void> {
  try {
    await db.paymentGatewayLog.create({
      data: {
        provider: entry.provider,
        direction: entry.direction,
        method: entry.method,
        url: entry.url,
        operation: entry.operation,
        requestHeaders: entry.requestHeaders
          ? (redact(entry.requestHeaders) as object)
          : undefined,
        requestBody: toJson(entry.requestBody) as object | undefined,
        responseStatus: entry.responseStatus,
        responseBody: toJson(entry.responseBody) as object | undefined,
        durationMs: entry.durationMs,
        success: entry.success ?? false,
        error: entry.error?.slice(0, 1000),
        chargeId: entry.chargeId,
        teamId: entry.teamId,
      },
    });
  } catch (err) {
    logger.error({ err }, "[GatewayLog] Falha ao gravar log de pagamento");
  }
}

/** Remove logs além do período de retenção. Retorna quantos apagou. */
export async function purgeOldGatewayLogs(): Promise<number> {
  const days = getLogRetentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await db.paymentGatewayLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
