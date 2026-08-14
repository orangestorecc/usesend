import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "~/server/db";
import { getRedis, redisKey } from "~/server/redis";
import { logger } from "~/server/logger/log";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function error(code: string, description: string, status = 400) {
  return NextResponse.json(
    { error: code, error_description: description },
    { status, headers: CORS },
  );
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Registro é anônimo por definição (RFC 7591) — o freio possível é a taxa. */
const REGISTROS_POR_HORA = 10;

/**
 * IP do cliente para fins de limite. Pega a ÚLTIMA entrada do X-Forwarded-For,
 * não a primeira: o proxy reverso acrescenta o IP real ao fim da cadeia, e o
 * começo é texto que o próprio cliente mandou — usá-lo deixaria o limite
 * burlável trocando o header a cada requisição.
 */
function ipDoCliente(req: Request): string {
  const doProxy = req.headers.get("x-real-ip")?.trim();
  if (doProxy) return doProxy;

  const cadeia = req.headers.get("x-forwarded-for");
  if (!cadeia) return "desconhecido";
  const partes = cadeia
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return partes[partes.length - 1] ?? "desconhecido";
}

async function excedeuLimite(req: Request): Promise<boolean> {
  const ip = ipDoCliente(req);
  try {
    const redis = getRedis();
    const key = redisKey(`oauth:register:${ip}`);
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 3600);
    if (n > REGISTROS_POR_HORA) {
      logger.warn({ ip, n }, "Registro OAuth dinâmico acima do limite");
      return true;
    }
    return false;
  } catch (err) {
    // Redis fora do ar não pode derrubar o fluxo de conexão legítimo.
    logger.error({ err }, "Falha no limite de registro OAuth");
    return false;
  }
}

/** https em qualquer lugar; http só para loopback (clientes de desktop/CLI). */
function isSafeRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOOPBACK.has(url.hostname);
}

/**
 * Dynamic Client Registration (RFC 7591).
 * Os clientes de IA se registram sozinhos antes de iniciar o fluxo OAuth.
 */
export async function POST(req: Request) {
  if (await excedeuLimite(req)) {
    return error(
      "temporarily_unavailable",
      "Muitos registros a partir deste endereço. Tente de novo mais tarde.",
      429,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return error("invalid_client_metadata", "Corpo JSON inválido.");
  }

  const redirectUris = body.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    redirectUris.length > 10 ||
    !redirectUris.every((u) => typeof u === "string" && u.length <= 2048)
  ) {
    return error(
      "invalid_redirect_uri",
      "redirect_uris é obrigatório e deve ser uma lista de até 10 URLs.",
    );
  }

  // Só aceitamos destinos navegáveis e criptografados. Sem isso, qualquer um
  // registra um cliente com redirect_uri `javascript:`/`http://` e usa a nossa
  // tela de consentimento (domínio legítimo, TLS legítimo) como isca.
  if (!(redirectUris as string[]).every(isSafeRedirectUri)) {
    return error(
      "invalid_redirect_uri",
      "Cada redirect_uri deve usar https:// (ou http://localhost em desenvolvimento).",
    );
  }

  // O nome aparece na tela de consentimento. Texto livre e longo vira vetor de
  // encenação ("… ✅ verificado pelo Madmail") e empurra o aviso para fora da
  // dobra — então corta em uma linha e sem quebras.
  const clientName =
    typeof body.client_name === "string"
      ? body.client_name.replace(/\s+/g, " ").trim().slice(0, 60) || null
      : null;
  const clientId = `mcpc_${randomBytes(12).toString("hex")}`;

  await db.oAuthClient.create({
    data: {
      clientId,
      clientName,
      redirectUris: redirectUris as string[],
    },
  });

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName ?? undefined,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: CORS },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
