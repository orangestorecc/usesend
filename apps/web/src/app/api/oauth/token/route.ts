import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "~/server/db";
import { addMcpKey, DEFAULT_SCOPES } from "~/server/service/mcp-key-service";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function oauthError(code: string, description: string, status = 400) {
  return NextResponse.json(
    { error: code, error_description: description },
    { status, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function readParams(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await req.json()) as Record<string, string>;
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  return Object.fromEntries(params.entries());
}

/**
 * Token endpoint OAuth 2.1 (authorization_code + PKCE S256).
 * Emite um access token que É uma McpKey (msk_) do time do usuário.
 */
export async function POST(req: Request) {
  const body = await readParams(req);

  if (body.grant_type !== "authorization_code") {
    return oauthError(
      "unsupported_grant_type",
      "Apenas authorization_code é suportado.",
    );
  }

  const { code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier } =
    body;

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return oauthError(
      "invalid_request",
      "code, redirect_uri, client_id e code_verifier são obrigatórios.",
    );
  }

  const authCode = await db.oAuthAuthCode.findUnique({ where: { code } });
  if (!authCode) {
    return oauthError("invalid_grant", "Código inválido ou já utilizado.");
  }

  // Consome o código imediatamente (uso único), independente do resultado.
  await db.oAuthAuthCode.delete({ where: { code } }).catch(() => undefined);

  if (authCode.expiresAt < new Date()) {
    return oauthError("invalid_grant", "Código expirado.");
  }
  if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
    return oauthError("invalid_grant", "client_id ou redirect_uri não conferem.");
  }

  // Verificação PKCE S256.
  const challenge = base64url(createHash("sha256").update(codeVerifier).digest());
  if (challenge !== authCode.codeChallenge) {
    return oauthError("invalid_grant", "Falha na verificação PKCE.");
  }

  const client = await db.oAuthClient.findUnique({
    where: { clientId },
  });

  // Emite a McpKey vinculada ao time — este é o access token.
  const accessToken = await addMcpKey({
    name: `MCP · ${client?.clientName ?? clientId}`,
    teamId: authCode.teamId,
    scopes: DEFAULT_SCOPES,
  });

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      scope: "mcp",
    },
    { headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
