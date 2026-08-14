# Madmail MCP

Servidor MCP que deixa o cliente comandar o Madmail por conversa (ChatGPT,
Claude, Cursor, Codex…). Transporte: Streamable HTTP, stateless.

Produção: `https://mcp.madmail.com.br/mcp` — deploy em `DEPLOY-PROD.md`.
Guia para o lojista: `apps/docs/guides/assistente-ia.mdx`.

## Autenticação

O servidor é **pass-through**: ele não guarda credencial de ninguém. O Bearer que
o cliente manda é usado direto contra a API v1 do app, que resolve time e escopos
a partir da tabela `McpKey` no banco.

Dois caminhos, ambos terminando numa `msk_`:

- **OAuth 2.1 + PKCE** (recomendado) — o cliente de IA se registra sozinho em
  `/api/oauth/register`, o usuário autoriza em `/oauth/authorize` e o
  `/api/oauth/token` emite a chave. É nessa tela que ele decide se a conexão
  pode enviar e-mail; sem marcar, a chave sai com `send: false`.
- **Chave fixa** criada em Configurações de dev → MCP, para servidor e CI.

O 401 devolve `WWW-Authenticate` apontando para
`/.well-known/oauth-protected-resource` (RFC 9728), servido tanto na raiz quanto
no sufixo `/mcp` — clientes descobrem o Authorization Server por qualquer um dos
dois caminhos.

## Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `8787` | Porta do servidor |
| `USESEND_BASE_URL` | `http://localhost:3000/api` | API v1 do app |
| `MCP_PUBLIC_URL` | `https://mcp.madmail.com.br/mcp` | Identidade do recurso no OAuth |
| `AUTH_SERVER_URL` | `https://app.madmail.com.br` | Authorization Server anunciado |
| `MCP_AUTH_CACHE_TTL_MS` | `60000` | Cache de resolução de escopos por token |

O cache é o motivo de uma chave revogada continuar valendo por até um minuto.

## Rodar local

```bash
cd mcp
pnpm install
pnpm start        # http://localhost:8787/mcp
```

Health check: `curl http://localhost:8787/health` → `{"ok":true}`

Conectar o Claude Code no servidor local:

```bash
claude mcp add --transport http madmail-local http://localhost:8787/mcp \
  --header "Authorization: Bearer msk_..."
```

## Ferramentas

🟢 leitura · 🟡 escrita reversível · 🔴 fala com gente real (exige `confirm:true`)

| Tool | Tipo | Escopo |
|---|---|---|
| `list_domains`, `get_domain` | 🟢 | sempre |
| `list_lists`, `list_contacts`, `get_contact` | 🟢 | `lists` / `contacts` |
| `list_campaigns`, `get_campaign_report`, `get_email` | 🟢 | `campaigns` |
| `get_analytics` | 🟢 | `analytics` |
| `get_reputation_status`, `get_bounce_breakdown` | 🟢 | `reputation` |
| `list_templates`, `get_template`, `render_preview` | 🟢 | `templates` |
| `list_segments`, `preview_segment` | 🟢 | `segments` |
| `get_usage` | 🟢 | sempre |
| `create_list`, `import_contacts` | 🟡 | `lists` / `contacts` |
| `unsubscribe_contact`, `update_contact`, `delete_contact` | 🟡 | `contacts` |
| `save_template` | 🟡 | `templates` |
| `create_campaign` (rascunho), `pause_campaign` | 🟡 | `campaigns` |
| `create_segment`, `materialize_segment`, `delete_segment` | 🟡 | `segments` |
| `send_campaign`, `schedule_campaign`, `send_email`, `resume_campaign`, `cancel_email` | 🔴 | `send` |

A tool só é **registrada** se o escopo permitir — o modelo nem enxerga o que não
pode usar, em vez de tentar e tomar 403.

Notas:

- `list_domains` existe porque sem ela o agente chuta o `from` e a campanha é
  recusada na validação de domínio. Chame antes de montar qualquer envio.
- `create_campaign` aceita `templateId` (herda content + subject) e injeta o
  rodapé de descadastro (no HTML e no JSON do editor) se faltar.
- `render_preview` renderiza o JSON do editor (TipTap) para HTML sem salvar.
  Fluxo: gerar JSON → `render_preview` → `save_template` → `create_campaign`.
- Tools 🔴 sem `confirm:true` retornam um resumo (destinatários, assunto,
  remetente) e não fazem nada. Isso é freio para o modelo, não consentimento
  humano — o controle real é o escopo `send`.
- `import_contacts` numa lista com double opt-in dispara e-mail de confirmação
  real, e isso **não** passa pelo escopo `send` — é o gate de `contacts`. A tela
  de consentimento avisa; a descrição da tool também.
- `get_usage` só calcula custo quando a integração tem plano por contato
  configurado; sem plano, devolve o número de contatos e uma observação
  explícita para o agente não inventar valor.

Segmentação: regras sobre `email/firstName/lastName/subscribed/properties.<chave>`,
ops `eq/neq/contains/in`, `match: all|any`. Para disparar a um segmento:
`create_segment` → `preview_segment` → `materialize_segment` → `create_campaign`.

## Telemetria

`usage.log.jsonl` grava cada chamada (`{ts, cliente, tool, status, args}`), com
os argumentos resumidos para não persistir HTML nem lista de contatos. É
best-effort e local ao processo — não serve como fonte de cobrança nem como
histórico para o cliente.
