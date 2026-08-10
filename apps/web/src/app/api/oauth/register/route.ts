import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "~/server/db";

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

/**
 * Dynamic Client Registration (RFC 7591).
 * Os clientes de IA se registram sozinhos antes de iniciar o fluxo OAuth.
 */
export async function POST(req: Request) {
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
    !redirectUris.every((u) => typeof u === "string")
  ) {
    return error(
      "invalid_redirect_uri",
      "redirect_uris é obrigatório e deve ser uma lista de URLs.",
    );
  }

  const clientName =
    typeof body.client_name === "string" ? body.client_name : null;
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
