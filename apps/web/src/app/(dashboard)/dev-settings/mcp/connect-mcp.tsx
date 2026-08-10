"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@usesend/ui/src/tabs";
import { Check, Copy, KeyRound } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "@usesend/ui/src/toaster";

const MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL || "https://mcp.madmail.com.br/mcp";

const TOKEN_PLACEHOLDER = "msk_sua_chave_aqui";

/** Copia texto e mostra feedback. */
function CopyBox({ text, mono = true }: { text: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      <pre
        className={`overflow-x-auto whitespace-pre-wrap break-all text-xs ${
          mono ? "font-mono" : ""
        }`}
      >
        {text}
      </pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label="Copiar"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

const OAUTH_NOTE =
  "O login por conta (OAuth) está a caminho. Enquanto isso, use uma das ferramentas de linha de comando/config abaixo (Cursor, Claude Code ou Codex), que aceitam o token no cabeçalho.";

export default function ConnectMcp() {
  const [token, setToken] = useState<string | null>(null);
  const createMutation = api.mcp.createMcpKey.useMutation();
  const utils = api.useUtils();

  const key = token ?? TOKEN_PLACEHOLDER;

  const generate = () => {
    createMutation.mutate(
      {
        name: `Integração ${new Date().toLocaleDateString("pt-BR")}`,
        scopes: {
          contacts: "write",
          lists: "write",
          templates: "write",
          segments: "write",
          campaigns: "write",
          analytics: "read",
          send: true,
        },
      },
      {
        onSuccess: (data) => {
          setToken(data);
          utils.mcp.invalidate();
          toast.success("Token gerado. Copie agora — ele só aparece uma vez.");
        },
        onError: (e) => toast.error(e.message ?? "Falha ao gerar o token"),
      },
    );
  };

  const cursorSnippet = `{
  "mcpServers": {
    "madmail": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer ${key}" }
    }
  }
}`;

  const claudeCodeSnippet = `claude mcp add --transport http madmail ${MCP_URL} \\
  --header "Authorization: Bearer ${key}"`;

  const codexSnippet = `[mcp_servers.madmail]
url = "${MCP_URL}"
http_headers = { "Authorization" = "Bearer ${key}" }`;

  return (
    <div className="rounded-lg border shadow-sm">
      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Integrações
        </div>
        <h2 className="text-lg font-semibold">Servidor MCP</h2>
        <p className="text-sm text-muted-foreground">
          Conecte sua IA favorita ao Madmail e dispare e-mails direto do chat.
        </p>
      </div>

      <div className="space-y-4 p-6">
        {/* URL do connector */}
        <div>
          <div className="mb-1 text-sm font-medium">URL do servidor</div>
          <CopyBox text={MCP_URL} />
        </div>

        {/* Token */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium">Token de acesso</span>
            <Button
              size="sm"
              variant="outline"
              onClick={generate}
              disabled={createMutation.isPending}
            >
              <KeyRound className="mr-1.5 h-4 w-4" />
              {createMutation.isPending
                ? "Gerando..."
                : token
                  ? "Gerar novo"
                  : "Gerar token"}
            </Button>
          </div>
          {token ? (
            <>
              <CopyBox text={token} />
              <p className="mt-1 text-xs text-amber-600">
                Guarde agora — o token só aparece uma vez.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Gere um token com acesso total ao seu time. Ele será inserido
              automaticamente nos exemplos abaixo.
            </p>
          )}
        </div>

        {/* Abas por ferramenta */}
        <Tabs defaultValue="cursor" className="pt-2">
          <TabsList>
            <TabsTrigger value="cursor">Cursor</TabsTrigger>
            <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
            <TabsTrigger value="codex">Codex</TabsTrigger>
            <TabsTrigger value="claude">Claude</TabsTrigger>
            <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
          </TabsList>

          <TabsContent value="cursor" className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Adicione ao arquivo <code>~/.cursor/mcp.json</code> (ou pelo
              Settings → MCP → Add):
            </p>
            <CopyBox text={cursorSnippet} />
          </TabsContent>

          <TabsContent value="claude-code" className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No terminal, rode:
            </p>
            <CopyBox text={claudeCodeSnippet} />
          </TabsContent>

          <TabsContent value="codex" className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Adicione ao <code>~/.codex/config.toml</code>:
            </p>
            <CopyBox text={codexSnippet} />
          </TabsContent>

          <TabsContent value="claude" className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No Claude (Desktop/Web): Configurações → Conectores → Adicionar
              conector personalizado e informe a URL:
            </p>
            <CopyBox text={MCP_URL} />
            <p className="text-xs text-amber-600">{OAUTH_NOTE}</p>
          </TabsContent>

          <TabsContent value="chatgpt" className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No ChatGPT: Configurações → Conectores (modo desenvolvedor) →
              Adicionar e informe a URL:
            </p>
            <CopyBox text={MCP_URL} />
            <p className="text-xs text-amber-600">{OAUTH_NOTE}</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
