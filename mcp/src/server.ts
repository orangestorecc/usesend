import "dotenv/config";
import express from "express";
import { appendFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { UseSendClient, UseSendHttpError } from "./usesend.js";
import type { McpScopes } from "./usesend.js";
import { registerTools } from "./tools.js";

const PORT = Number(process.env.PORT ?? 8787);
const BASE_URL = process.env.USESEND_BASE_URL ?? "http://localhost:3000/api";
const USAGE_LOG = "usage.log.jsonl";
const AUTH_CACHE_TTL_MS = Number(process.env.MCP_AUTH_CACHE_TTL_MS ?? 60_000);

// OAuth: URL pública deste MCP (Resource Server) e do Authorization Server (app Madmail).
const MCP_PUBLIC_URL =
  process.env.MCP_PUBLIC_URL ?? "https://mcp.madmail.com.br/mcp";
const AUTH_SERVER_URL =
  process.env.AUTH_SERVER_URL ?? "https://app.madmail.com.br";
const PROTECTED_RESOURCE_METADATA = `${new URL(MCP_PUBLIC_URL).origin}/.well-known/oauth-protected-resource`;

function bearer(req: express.Request): string | null {
  const h = req.header("authorization") ?? "";
  const [scheme, token] = h.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

// 401 com o header WWW-Authenticate que aponta os clientes de IA ao fluxo OAuth.
function unauthorized(res: express.Response, message: string) {
  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${PROTECTED_RESOURCE_METADATA}"`,
  );
  return res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message },
    id: null,
  });
}

// 503 para falha transitória do useSend — não é problema do token do cliente,
// então não pode virar 401 (o cliente descartaria a credencial como inválida).
function servicoIndisponivel(res: express.Response, message: string) {
  res.setHeader("Retry-After", "5");
  return res.status(503).json({
    jsonrpc: "2.0",
    error: { code: -32003, message },
    id: null,
  });
}

class ErroTransitorioDeAuth extends Error {}

// O handshake do MCP dispara várias requisições em rajada, e cada uma revalidava
// o token no useSend. Cache + dedup de chamadas em voo mantêm isso em 1 chamada.
const authCache = new Map<string, { scopes: McpScopes; expiraEm: number }>();
const authEmVoo = new Map<string, Promise<McpScopes>>();

async function resolverEscopos(
  token: string,
  client: UseSendClient,
): Promise<McpScopes> {
  const emCache = authCache.get(token);
  if (emCache && emCache.expiraEm > Date.now()) return emCache.scopes;

  const emVoo = authEmVoo.get(token);
  if (emVoo) return emVoo;

  const pendente = (async () => {
    try {
      const me = await client.getMcpMe();
      authCache.set(token, {
        scopes: me.scopes,
        expiraEm: Date.now() + AUTH_CACHE_TTL_MS,
      });
      return me.scopes;
    } catch (err) {
      const status = err instanceof UseSendHttpError ? err.status : 0;
      // Só 401/403 significam token realmente inválido.
      if (status === 401 || status === 403) {
        authCache.delete(token);
        throw err;
      }
      // Timeout, 429 ou 5xx: se já validamos esse token antes, seguimos com os
      // escopos vencidos em vez de derrubar a sessão por instabilidade.
      const vencido = authCache.get(token);
      if (vencido) return vencido.scopes;
      throw new ErroTransitorioDeAuth(
        "Não foi possível validar o token agora (useSend indisponível). Tente de novo em instantes.",
      );
    } finally {
      authEmVoo.delete(token);
    }
  })();

  authEmVoo.set(token, pendente);
  return pendente;
}

// Evita que o cache cresça sem limite com tokens que não voltam mais.
const limpezaDoCache = setInterval(() => {
  const agora = Date.now();
  for (const [token, entrada] of authCache) {
    // Margem: entradas vencidas ainda servem de fallback por um ciclo.
    if (entrada.expiraEm + AUTH_CACHE_TTL_MS * 10 < agora) authCache.delete(token);
  }
}, AUTH_CACHE_TTL_MS);
limpezaDoCache.unref();

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Metadados do Protected Resource (RFC 9728) — descoberta do Authorization Server.
// Servido nos dois caminhos de propósito: como o recurso tem path (/mcp), a RFC
// manda o cliente procurar em /.well-known/oauth-protected-resource/mcp. Quem
// segue o WWW-Authenticate acha na raiz; quem deriva sozinho acha no sufixo.
app.get(
  ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"],
  (_req, res) => {
    res.json({
      resource: MCP_PUBLIC_URL,
      authorization_servers: [AUTH_SERVER_URL],
      bearer_methods_supported: ["header"],
    });
  },
);

app.post("/mcp", async (req, res) => {
  const token = bearer(req);
  if (!token) {
    return unauthorized(
      res,
      "Token ausente. Faça login com sua conta Madmail (OAuth) ou use um token msk_.",
    );
  }

  // O MCP é pass-through: usa o token do cliente direto contra o useSend,
  // que resolve time + escopos (tabela McpKey no banco).
  const client = new UseSendClient(BASE_URL, token);
  let scopes: McpScopes;
  try {
    scopes = await resolverEscopos(token, client);
  } catch (err) {
    if (err instanceof ErroTransitorioDeAuth) {
      return servicoIndisponivel(res, err.message);
    }
    return unauthorized(res, "Token de MCP inválido ou expirado.");
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
