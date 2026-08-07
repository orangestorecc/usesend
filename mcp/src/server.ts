import "dotenv/config";
import express from "express";
import { appendFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { UseSendClient } from "./usesend.js";
import { registerTools } from "./tools.js";

const PORT = Number(process.env.PORT ?? 8787);
const BASE_URL = process.env.USESEND_BASE_URL ?? "http://localhost:3000/api";
const USAGE_LOG = "usage.log.jsonl";

function bearer(req: express.Request): string | null {
  const h = req.header("authorization") ?? "";
  const [scheme, token] = h.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/mcp", async (req, res) => {
  const token = bearer(req);
  if (!token) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Token ausente (Authorization: Bearer msk_...)" },
      id: null,
    });
  }

  // O MCP é pass-through: usa o token do cliente direto contra o useSend,
  // que resolve time + escopos (tabela McpKey no banco).
  const client = new UseSendClient(BASE_URL, token);
  let scopes;
  try {
    const me = await client.getMcpMe();
    scopes = me.scopes;
  } catch {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Token de MCP inválido" },
      id: null,
    });
  }

  const clienteLabel = `${token.slice(0, 7)}...${token.slice(-3)}`;
  const log = (tool: string, args: unknown, status: "ok" | "error") => {
    const entry = {
      ts: new Date().toISOString(),
      cliente: clienteLabel,
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
  registerTools(server, client, log, scopes);

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
  console.log(`[mcp] useSend MCP rodando em http://localhost:${PORT}/mcp`);
  console.log(`[mcp] useSend base: ${BASE_URL}`);
  console.log(`[mcp] auth: token msk_ resolvido pelo useSend (McpKey no banco)`);
});
