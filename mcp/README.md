# useSend MCP (N49) — Fase 0

Servidor MCP que deixa o cliente comandar o useSend por conversa (ChatGPT/Claude).
Multi-cliente: cada cliente usa um token `msk_<cliente>` que mapeia pra API key do time no useSend.

## Pré-requisitos (já configurados no ambiente local)
- useSend dev rodando em `http://localhost:3000` (`cd C:\Dev\usesend && pnpm dev`) + containers Docker up.
- API key de teste do team N49 já criada; token de MCP `msk_test` mapeado em `.env`.
- Domínio `dress.com` marcado como verificado no banco local (pra permitir criar/enviar campanha).

## Rodar o servidor MCP
```bash
cd C:\Dev\usesend\mcp
npm install      # primeira vez
npm start        # sobe em http://localhost:8787/mcp
```
Health check: `curl http://localhost:8787/health` → `{"ok":true,"clientes":1}`

## Conectar no Claude Code e testar por conversa
Com o servidor no ar, num terminal:
```bash
claude mcp add --transport http usesend-n49 http://localhost:8787/mcp --header "Authorization: Bearer msk_test"
```
Reinicie a sessão do Claude e converse, ex.:
- "Liste minhas listas de e-mail"
- "Crie uma lista chamada Clientes VIP"
- "Importe os contatos ana@x.com e bruno@y.com na lista Clientes VIP"
- "Monte uma campanha de coleção de inverno pra essa lista, remetente news@dress.com"
- "Dispara a campanha" → o MCP pede confirmação antes de enviar

## Ferramentas (Fase 0)
🟢 leitura · 🟡 escrita reversível · 🔴 envia p/ gente real (exige `confirm:true`)

| Tool | Tipo |
|---|---|
| `list_lists`, `list_contacts`, `list_campaigns`, `get_campaign_report`, `get_analytics` | 🟢 |
| `list_templates`, `get_template`, `render_preview` (Fase 1) | 🟢 |
| `list_segments`, `preview_segment` (Fase 2) | 🟢 |
| `get_usage`, `billing_summary` (Fase 3) | 🟢 |
| `create_list`, `import_contacts`, `save_template` (Fase 1), `create_campaign` (rascunho) | 🟡 |
| `create_segment`, `materialize_segment`, `delete_segment` (Fase 2) | 🟡 |
| `send_campaign`, `schedule_campaign`, `send_email` | 🔴 |

Segmentação (Fase 2): regras sobre `email/firstName/lastName/subscribed/properties.<chave>`, ops `eq/neq/contains/in`, `match: all|any`.
Fluxo p/ disparar a um segmento: `create_segment` → `preview_segment` (confere quantos) → `materialize_segment` (vira uma lista) → `create_campaign` nessa lista.

- `create_campaign` aceita `templateId` (herda content+subject) e injeta rodapé de descadastro (no html E no content JSON) se faltar.
- `render_preview` renderiza o JSON do editor (TipTap) → HTML sem salvar. Fluxo IA: gerar JSON → render_preview → save_template → create_campaign.
- Tools 🔴 sem `confirm:true` retornam um **resumo** (destinatários, assunto, remetente) e não enviam.

## Log de uso e cobrança (Fase 3) — POR CONTATO
- `usage.log.jsonl` — telemetria: cada chamada (`{ts, cliente, tool, status, args_resumidos}`), sem PII/segredos.
- Cobrança **por contato**: planos em `.env` `MCP_PLANS` (`msk_x=nome:precoPorContatoBRL:minContatos`, ex.: `msk_test=padrao:0.10:1000`).
- Tools `get_usage` / `billing_summary` retornam: contatos atuais, contatos faturáveis (respeita mínimo) e custo mensal em BRL.

## Limitações conhecidas da Fase 0
- **Entrega real via SES não está garantida**: o emulador local (`local-ses-sns`) não implementa
  todo o `CreateEmailIdentity`; o domínio foi verificado direto no banco pra destravar a criação de
  campanha. Disparo de verdade precisa fechar a integração com o emulador (ou usar SES real).
- Listas são criadas com **double opt-in** ligado (padrão do useSend) → contatos importados entram
  como não-confirmados, por isso `destinatarios` pode aparecer 0. Ajustável na Fase 1.
- Templates e segmentação: **Fase 1 e 2** (ver `../mcp/DESIGN.md`).
