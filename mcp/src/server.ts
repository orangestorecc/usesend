import "dotenv/config";
import express from "express";
import { appendFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { UseSendClient } from "./usesend.js";
import { registerTools } from "./tools.js";
import * as billing from "./billing.js";

const PORT = Number(process.env.PORT ?? 8787);
const BASE_URL = process.env.USESEND_BASE_URL ?? "http://localhost:3000/api";
const USAGE_LOG = "usage.log.jsonl";

// Mapa token-de-MCP -> API key do useSend (por cliente).
const tokenMap = new Map<string, string>();
for (const pair of (process.env.MCP_TOKEN_MAP ?? "").split(";")) {
  const [tok, key] = pair.split("=");
  if (tok && key) tokenMap.set(tok.trim(), key.trim());
}
if (tokenMap.size === 0) {
  console.error("[mcp] AVISO: MCP_TOKEN_MAP vazio — nenhum cliente configurado.");
}

function bearer(req: express.Request): string | null {
  const h = req.header("authorization") ?? "";
  const [scheme, token] = h.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, clientes: tokenMap.size }));

app.post("/mcp", async (req, res) => {
  const mcpToken = bearer(req);
  const apiKey = mcpToken ? tokenMap.get(mcpToken) : undefined;
  if (!apiKey) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Token de MCP inválido ou ausente (Authorization: Bearer msk_...)" },
      id: null,
    });
  }

  const client = new UseSendClient(BASE_URL, apiKey);
  const log = (tool: string, args: unknown, status: "ok" | "error") => {
    const entry = {
      ts: new Date().toISOString(),
      cliente: mcpToken,
      tool,
      status,
      args: summarizeArgs(args),
    };
    try {
      appendFileSync(USAGE_LOG, JSON.stringify(entry) + "\n");
    } catch {
      /* log é best-effort */
    }
  };

  const server = new McpServer({ name: "usesend-mcp", version: "0.0.1" });
  registerTools(server, client, log, billing.forClient(mcpToken!));

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Stateless: GET/DELETE não são usados.
const methodNotAllowed = (_req: express.Request, res: express.Response) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed (servidor stateless)." },
    id: null,
  });
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

// Evita vazar segredos/PII no log de uso.
function summarizeArgs(args: unknown): unknown {
  if (!args || typeof args !== "object") return args;
  const a = { ...(args as Record<string, unknown>) };
  if (Array.isArray(a.contacts)) a.contacts = `[${a.contacts.length} contatos]`;
  if (typeof a.html === "string") a.html = `[html ${a.html.length} chars]`;
  if (typeof a.content === "string") a.content = `[content ${a.content.length} chars]`;
  return a;
}

app.listen(PORT, () => {
  console.log(`[mcp] useSend MCP (Fase 0) rodando em http://localhost:${PORT}/mcp`);
  console.log(`[mcp] useSend base: ${BASE_URL}`);
  console.log(`[mcp] clientes configurados: ${[...tokenMap.keys()].join(", ") || "(nenhum)"}`);
});
