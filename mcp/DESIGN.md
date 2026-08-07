# MCP do useSend (N49) — Desenho de Arquitetura

> Camada MCP sobre o useSend para o cliente (lojista) comandar e-mail marketing/transacional
> por conversa (ChatGPT ou Claude), sem entrar no sistema. Multi-cliente, com chave por cliente
> e log de uso para cobrança.
>
> Status: **desenho** (30/07/2026). Construção roda nesta pasta (`C:\Dev\usesend`).

---

## 1. Objetivo

O lojista conversa com um assistente (ChatGPT/Claude) e faz o fluxo inteiro:

```
subir contatos → criar lista → segmentar → gerar o e-mail (IA) → preview → disparar → relatório
```

Diferencial vs. concorrentes (benchmark 30/07):
- **Resend**: tem IA no editor, mas só rascunha 1 e-mail dentro do editor; UX é pra dev.
- **Acelle**: drag-and-drop com widgets amigáveis, mas ainda é "monte você".
- **Nosso MCP**: o assistente faz o fluxo **inteiro** por conversa. O lojista não monta template — ele **pede**.

Achado-chave do benchmark: o editor visual do useSend **é o mesmo do Resend** (engine TipTap).
Logo não estamos atrás no canvas — estamos atrás em IA, segmentação e templates-com-API. O MCP
fecha exatamente essas lacunas.

---

## 2. Multi-tenant: "chave de MCP por cliente" + log de uso

Auth do useSend já é `1 API key → 1 team` (`getTeamFromToken`). Cada **cliente = 1 team + 1 API key**.

Fluxo de chave:

```
Cliente configura o connector (ChatGPT/Claude) com um token:  msk_<cliente>
        │
        ▼
MCP server mapeia  msk_<cliente>  →  useSend API key do team do cliente
        │
        ▼
Todas as chamadas ao useSend usam a key daquele team  → isolamento multi-tenant nativo
```

- **Token de MCP por cliente** (`msk_...`), revogável, independente da API key do useSend por baixo.
- **Log de uso**: cada chamada de ferramenta grava `{ cliente, tool, resumo_args, status, timestamp, contadores(emails, contatos) }`.
  - Alimenta a cobrança (ex.: plano Paulo/DRESS&CO = R$250/mês até 50k disparos).
  - Base de dados de uso do useSend já existe (`DailyEmailUsage`, `CumulatedMetrics`) — o log do MCP é a camada por-token por cima.

---

## 3. Arquitetura

```
┌─────────────────────┐     msk_<cliente>      ┌───────────────────────────┐
│ ChatGPT / Claude    │ ─────────────────────▶ │  MCP server (TS)          │
│ (connector do lojista)                       │  - auth por token         │
└─────────────────────┘                        │  - log de uso             │
                                               │  - guardrails de envio    │
                                               └───────────┬───────────────┘
                                                           │ API key do team
                            ┌──────────────────────────────┼──────────────────────────────┐
                            ▼                               ▼                              ▼
                  packages/sdk (já existe)        NOVO: endpoints de           EmailRenderer (já existe)
                  emails, campaigns,              segmento (/v1/segments)      JSON TipTap → HTML
                  contacts, contact-books,        + expor templates
                  domains, analytics              (/v1/templates)
                            └──────────────────────────────┴──────────────────────────────┘
                                                           │
                                                           ▼
                                                   useSend (Postgres + BullMQ) → SES v2
```

- Reusa `packages/sdk` para tudo que já é endpoint público.
- Dois grupos de endpoint novos no fork: **segments** (model novo) e **templates** (expor o que já existe).
- Geração do e-mail: o **modelo do connector** (ChatGPT/Claude) produz o JSON TipTap; o MCP **valida e renderiza** via `EmailRenderer` já existente. Sem custo de LLM do nosso lado.

---

## 4. Ferramentas do MCP

Legenda: 🟢 leitura/segura · 🟡 escrita reversível · 🔴 **envia p/ gente real — exige confirmação explícita**

### Contatos & Listas  (SDK existente)
| Tool | Tipo | Mapeia p/ |
|---|---|---|
| `list_lists` | 🟢 | contact-books get-all |
| `create_list` | 🟡 | create contact-book |
| `import_contacts` | 🟡 | bulk-add-contacts (array ou CSV colado) |
| `list_contacts` | 🟢 | get-contacts |
| `upsert_contact` | 🟡 | upsert-contact |
| `delete_contacts` | 🟡 | bulk-delete-contacts |

### Segmentação  (**serviço NOVO** — ver §5)
| Tool | Tipo | Observação |
|---|---|---|
| `list_segments` | 🟢 | |
| `create_segment` | 🟡 | nome + regras sobre `Contact.properties` / subscribed / nome / email |
| `preview_segment` | 🟢 | retorna contagem + amostra, **sem enviar** |
| `delete_segment` | 🟡 | |

### Templates & Conteúdo  (**expor existente** — ver §5)
| Tool | Tipo | Observação |
|---|---|---|
| `list_templates` | 🟢 | |
| `get_template` | 🟢 | retorna `content` (JSON) + `html` |
| `save_template` | 🟡 | recebe JSON TipTap (gerado pelo assistente) |
| `render_preview` | 🟢 | JSON TipTap → HTML (via EmailRenderer); devolve preview |

### Campanhas
| Tool | Tipo | Observação |
|---|---|---|
| `create_campaign` | 🟡 | lista **ou** segmento + template/conteúdo + from/subject; fica em rascunho |
| `preview_campaign` | 🟢 | renderiza p/ um contato de amostra |
| `schedule_campaign` | 🔴 | agenda (aceita "amanhã 9h" em linguagem natural) |
| `send_campaign` | 🔴 | dispara agora — **confirmação obrigatória** |
| `pause_campaign` / `resume_campaign` | 🟡 | |
| `get_campaign_report` | 🟢 | enviados/entregues/abertos/cliques/bounces |

### Transacional
| Tool | Tipo | Observação |
|---|---|---|
| `send_email` | 🔴 | e-mail avulso — confirmação obrigatória |

### Relatórios & Setup
| Tool | Tipo | Observação |
|---|---|---|
| `get_analytics` | 🟢 | time-series + reputação |
| `list_domains` / `add_domain` / `verify_domain` | 🟢/🟡 | onboarding do cliente |

---

## 5. Os 2 serviços novos

### 5a. Templates — **expor o que já existe** (esforço baixo, sem migração)
O model `Template { id, name, teamId, subject, html, content }` já existe (usado pela UI/tRPC).
Falta só o endpoint público:
- `GET /v1/templates`, `GET /v1/templates/:id`, `POST /v1/templates`, `PATCH /v1/templates/:id`
- `POST /v1/templates/render` (recebe `content` JSON, devolve `html` via `EmailRenderer`)
- Estender `campaignCreateSchema` para aceitar `templateId` (resolve p/ `content` no envio).

### 5b. Segmentação — **model novo + motor de regras** (esforço médio)
Não existe `Segment` hoje; targeting é só por lista inteira. Adicionar:
```prisma
model Segment {
  id            String   @id @default(cuid())
  teamId        Int
  contactBookId String?           // opcional: escopar a uma lista
  name          String
  rules         Json              // ex.: { all: [ {field:"properties.cidade", op:"eq", value:"SP"}, {field:"subscribed", op:"eq", value:true} ] }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```
- Motor de regras opera sobre `Contact.properties` (Json), `subscribed`, `firstName/lastName/email`.
- Endpoints: `GET/POST /v1/segments`, `POST /v1/segments/:id/preview` (contagem+amostra), `DELETE`.
- `campaignCreateSchema` passa a aceitar `segmentId` (expande p/ destinatários no envio).
- **Alternativa sem migração** (v0 mais rápido): resolver no MCP — puxa contatos, filtra por propriedade, cria lista transitória. Fica pior de reusar na UI; usar só se quisermos validar antes de mexer no schema.

---

## 6. Guardrails de envio (obrigatório)
- Toda tool 🔴 exige **confirmação explícita na conversa**, mostrando: nº de destinatários, `from`, `subject`, e amostra de preview.
- Teto de volume por cliente (ex.: 50k/mês no plano do Paulo) verificado antes do disparo.
- `preview_campaign` / `render_preview` são passo de primeira classe antes de qualquer 🔴.

---

## 7. Stack & deploy
- **MCP server em TypeScript** (`@modelcontextprotocol/sdk`), reusa `packages/sdk` do useSend.
- Transporte **HTTP/SSE** (remote MCP connector) — funciona em ChatGPT e Claude.
- Auth por header `Authorization: Bearer msk_<cliente>`.
- Mora nesta pasta (novo workspace `mcp/` no monorepo) pra compartilhar tipos/SDK.

---

## 8. Roadmap por fases
1. **Fase 0 — MCP read-only + envio transacional** com endpoints que já existem (listas, contatos, campanha por HTML/conteúdo, envio, relatório). Valida o loop com o Paulo em dias.
2. **Fase 1 — Templates via API** (expor existente) + `save_template`/`render_preview` → IA gera e salva.
3. **Fase 2 — Segmentação** (model `Segment` + motor de regras + `segmentId` na campanha).
4. **Fase 3 — Log de uso por token + cobrança** (planos/volume).
5. **Fase 4 (depois) — polir editor drag-and-drop** (naming amigável estilo Acelle) — baixa prioridade, canvas já herdado do Resend.
