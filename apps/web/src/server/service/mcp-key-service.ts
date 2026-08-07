import { db } from "../db";
import { randomBytes } from "crypto";
import { smallNanoid } from "../nanoid";
import { createSecureHash, verifySecureHash } from "../crypto";
import { logger } from "../logger/log";

// Escopos de uma integração MCP. Por capacidade: none | read | write (write implica read).
// analytics: none | read. send: boolean (ação sensível, separada).
export type McpScopeLevel = "none" | "read" | "write";
export type McpScopes = {
  contacts: McpScopeLevel;
  lists: McpScopeLevel;
  templates: McpScopeLevel;
  segments: McpScopeLevel;
  campaigns: McpScopeLevel;
  analytics: "none" | "read";
  send: boolean;
  // Cobrança por contato (opcional) — fica junto da integração p/ o MCP calcular uso.
  plan?: { pricePerContactBRL: number; minContacts: number };
};

export const DEFAULT_SCOPES: McpScopes = {
  contacts: "write",
  lists: "write",
  templates: "write",
  segments: "write",
  campaigns: "write",
  analytics: "read",
  send: true,
};

export async function addMcpKey({
  name,
  teamId,
  scopes,
}: {
  name: string;
  teamId: number;
  scopes: McpScopes;
}) {
  const clientId = smallNanoid(10);
  const token = randomBytes(16).toString("hex");
  const hashedToken = await createSecureHash(token);
  const mcpKey = `msk_${clientId}_${token}`;

  await db.mcpKey.create({
    data: {
      name,
      teamId,
      clientId,
      tokenHash: hashedToken,
      partialToken: `${mcpKey.slice(0, 7)}...${mcpKey.slice(-3)}`,
      scopes: scopes as object,
    },
  });

  // Só retornado no momento da criação (não é recuperável depois).
  return mcpKey;
}

export async function getTeamAndMcpKey(mcpToken: string) {
  const [, clientId, token] = mcpToken.split("_") as [string, string, string];
  if (!clientId || !token) return null;

  const row = await db.mcpKey.findUnique({ where: { clientId } });
  if (!row) return null;

  try {
    const isValid = await verifySecureHash(token, row.tokenHash);
    if (!isValid) return null;

    const team = await db.team.findUnique({ where: { id: row.teamId } });
    if (!team) return null;

    // best-effort lastUsed
    db.mcpKey
      .update({ where: { id: row.id }, data: { lastUsed: new Date() } })
      .catch((err) => logger.error({ err }, "Failed to update mcpKey lastUsed"));

    return { team, mcpKey: row, scopes: row.scopes as unknown as McpScopes };
  } catch (error) {
    logger.error({ err: error }, "Error verifying MCP key");
    return null;
  }
}

export async function listMcpKeys(teamId: number) {
  return db.mcpKey.findMany({
    where: { teamId },
    select: {
      id: true,
      name: true,
      partialToken: true,
      scopes: true,
      lastUsed: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteMcpKey(id: string, teamId: number) {
  await db.mcpKey.delete({ where: { id, teamId } });
}
