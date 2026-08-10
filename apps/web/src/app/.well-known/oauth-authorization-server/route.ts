import { NextResponse } from "next/server";
import { env } from "~/env";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

/**
 * Metadados do Authorization Server OAuth 2.1 (RFC 8414).
 * Consumido pelos clientes de IA (Claude, ChatGPT, Cursor…) para descobrir
 * como autenticar contra o MCP do Madmail.
 */
export function GET() {
  const issuer = env.NEXTAUTH_URL.replace(/\/$/, "");

  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    },
    { headers: CORS },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
