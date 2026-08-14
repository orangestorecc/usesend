"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@usesend/ui/src/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@usesend/ui/src/accordion";
import { Badge } from "@usesend/ui/src/badge";
import { Check, Copy, Monitor } from "lucide-react";

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

/** Um passo numerado dentro de uma aba. */
function Passos({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ol className="space-y-2 text-sm text-muted-foreground">
      {itens.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

export default function ConnectMcp() {
  const cursorSnippet = `{
  "mcpServers": {
    "madmail": {
      "url": "${MCP_URL}"
    }
  }
}`;

  const cursorComChave = `{
  "mcpServers": {
    "madmail": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer ${TOKEN_PLACEHOLDER}" }
    }
  }
}`;

  const claudeCodeSnippet = `claude mcp add --transport http madmail ${MCP_URL}`;

  const claudeCodeComChave = `claude mcp add --transport http madmail ${MCP_URL} \\
  --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"`;

  const codexSnippet = `[mcp_servers.madmail]
url = "${MCP_URL}"`;

  const vscodeSnippet = `{
  "servers": {
    "madmail": {
      "type": "http",
      "url": "${MCP_URL}"
    }
  }
}`;

  return (
    <div className="rounded-lg border shadow-sm">
      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Integrações
        </div>
        <h2 className="text-lg font-semibold">
          Ligar o Madmail ao seu assistente de IA
        </h2>
        <p className="text-sm text-muted-foreground">
          Depois de ligar, você pede no chat — “como foi a campanha de sexta?”,
          “monta uma promoção para os clientes de São Paulo” — e ele faz na sua
          conta.
        </p>
      </div>

      <div className="space-y-5 p-6">
        {/* Pré-requisitos: dizer isso ANTES de prometer qualquer coisa. */}
        <div className="flex gap-3 rounded-lg border bg-muted/20 p-4 text-sm">
          <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="font-medium">Antes de começar</div>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>
                A ligação é feita <strong>no computador</strong>, dentro do
                aplicativo de IA. Não dá pelo celular.
              </li>
              <li>
                No ChatGPT e no Claude, adicionar um aplicativo externo exige{" "}
                <strong>plano pago</strong>.
              </li>
              <li>
                Quem liga é o aplicativo de IA — aqui você só copia o endereço e
                segue o passo a passo.
              </li>
            </ul>
          </div>
        </div>

        {/* Passo 1 */}
        <div>
          <div className="mb-1 text-sm font-medium">
            1. Copie o endereço do Madmail
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            É o endereço que o aplicativo de IA usa para falar com o Madmail.
            Não é um site — não adianta abrir no navegador.
          </p>
          <CopyBox text={MCP_URL} />
        </div>

        {/* Passo 2 */}
        <div>
          <div className="mb-2 text-sm font-medium">
            2. Cole no seu aplicativo de IA
          </div>

          <Tabs defaultValue="chatgpt">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <TabsList>
                <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
                <TabsTrigger value="claude">Claude</TabsTrigger>
              </TabsList>
              <span className="text-xs text-muted-foreground">
                para quem programa:
              </span>
              <TabsList>
                <TabsTrigger value="cursor">Cursor</TabsTrigger>
                <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
                <TabsTrigger value="codex">Codex</TabsTrigger>
                <TabsTrigger value="vscode">VS Code</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chatgpt" className="space-y-3 pt-2">
              <Passos
                itens={[
                  "No computador, abra o ChatGPT e vá em Configurações.",
                  "Procure “Aplicativos e conectores” e ligue a chave “Modo desenvolvedor” — é uma opção dessa tela, pode ligar sem medo.",
                  "Clique em Criar e cole o endereço acima. Em Autenticação, escolha OAuth (é o jeito de entrar com a sua conta do Madmail).",
                  "O Madmail vai abrir uma tela perguntando se você permite. Confira o endereço mostrado nela e clique em Permitir.",
                ]}
              />
            </TabsContent>

            <TabsContent value="claude" className="space-y-3 pt-2">
              <Passos
                itens={[
                  "No computador, abra o Claude e vá em Configurações.",
                  "Em “Conectores”, clique em adicionar um conector personalizado.",
                  "Cole o endereço acima e confirme.",
                  "O Madmail vai abrir uma tela perguntando se você permite. Confira o endereço mostrado nela e clique em Permitir.",
                ]}
              />
            </TabsContent>

            <TabsContent value="cursor" className="space-y-2 pt-2">
              <p className="text-sm text-muted-foreground">
                Adicione ao arquivo <code>~/.cursor/mcp.json</code> (ou em
                Settings → MCP → Add):
              </p>
              <CopyBox text={cursorSnippet} />
              <p className="text-xs text-muted-foreground">
                Depois, clique em <strong>Login</strong> no servidor{" "}
                <code>madmail</code> para entrar com a sua conta.
              </p>
            </TabsContent>

            <TabsContent value="claude-code" className="space-y-2 pt-2">
              <p className="text-sm text-muted-foreground">No terminal:</p>
              <CopyBox text={claudeCodeSnippet} />
              <p className="text-xs text-muted-foreground">
                Depois rode <code>/mcp</code> dentro do Claude Code e escolha
                autenticar.
              </p>
            </TabsContent>

            <TabsContent value="codex" className="space-y-2 pt-2">
              <p className="text-sm text-muted-foreground">
                Adicione ao <code>~/.codex/config.toml</code>:
              </p>
              <CopyBox text={codexSnippet} />
              <p className="text-xs text-muted-foreground">
                Depois rode <code>codex mcp login madmail</code>.
              </p>
            </TabsContent>

            <TabsContent value="vscode" className="space-y-2 pt-2">
              <p className="text-sm text-muted-foreground">
                Crie <code>.vscode/mcp.json</code> no seu projeto:
              </p>
              <CopyBox text={vscodeSnippet} />
              <p className="text-xs text-muted-foreground">
                Clique em <strong>Start</strong> acima do servidor e faça login
                na janela que abrir.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Passo 3 — o que esperar da tela de permissão. */}
        <div>
          <div className="mb-1 text-sm font-medium">
            3. Confira a tela de permissão
          </div>
          <p className="text-sm text-muted-foreground">
            O Madmail vai mostrar quem está pedindo acesso e{" "}
            <strong>para onde esse acesso vai</strong>. Se o endereço na tela
            não for o do aplicativo que você está usando, clique em Não
            permitir. Lá também tem a caixinha que decide se o assistente pode
            enviar e-mail de verdade — desmarcada, ele monta tudo e quem aperta
            enviar é você.
          </p>
        </div>

        {/* Avançado: chave fixa, para quando não há navegador. */}
        <Accordion type="single" collapsible>
          <AccordionItem value="chave" className="border-b-0">
            <AccordionTrigger className="text-sm">
              Para quem programa: usar sem fazer login
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Onde não dá para abrir uma janela de login — um servidor seu, um
                robô que roda sozinho — use uma chave fixa no lugar da conta.
                Crie a chave abaixo, na seção “Chaves do MCP”, e escolha ali o
                que ela pode fazer.
              </p>
              <p className="text-sm text-muted-foreground">
                A chave é uma senha: quem tiver ela mexe na sua conta sem
                precisar do seu login. Guarde em variável de ambiente, nunca no
                Git.
              </p>

              <div>
                <div className="mb-1 text-xs font-medium">Cursor</div>
                <CopyBox text={cursorComChave} />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium">Claude Code</div>
                <CopyBox text={claudeCodeComChave} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="text-xs text-muted-foreground">
          Dá para desligar quando quiser, na lista abaixo. O acesso cai em até
          um minuto. <Badge variant="secondary">Sem custo extra</Badge>
        </p>
      </div>
    </div>
  );
}
