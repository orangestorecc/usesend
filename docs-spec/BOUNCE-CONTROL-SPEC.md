# Madmail — Controle de Bounce: alerta, bloqueio e recuperação
**Para: CEO · De: Direção de Engenharia · Consolidação dos tracks Produto/UX, Backend/API e DevOps/Automação, com supervisão adversarial (Gauntlet Loop — 13/08/2026)**

Escopo: sistema que mede a taxa de retorno definitivo (hard bounce) de cada time em tempo quase real, avisa antes do problema virar risco, **bloqueia novos disparos** quando a faixa de tolerância é ultrapassada — sem tirar o acesso ao painel — e devolve o envio quando a conta se recupera. Faixa de tolerância acordada: **0,4% a 2%**.

---

## 0. Conflitos entre tracks e como foram resolvidos

| # | Conflito | Decisão |
|---|---|---|
| 1 | **Base de cálculo**: Produto queria reusar o número já exibido no dashboard (`CumulatedMetrics`, acumulado desde sempre); Backend apontou que é vitalício e **nunca se recupera** — uma conta com histórico ruim ficaria bloqueada para sempre. | **Janela deslizante de 30 dias** sobre `DailyEmailUsage`. O acumulado vitalício continua existindo, mas vira métrica informativa ("histórico"), nunca gatilho de bloqueio. |
| 2 | **Denominador**: `delivered` (como hoje) vs `sent`. | **`delivered + hardBounced`** = entregas com veredito. `sent` inclui mensagens ainda sem retorno do provedor e inflaria a taxa nas primeiras horas de uma campanha; `delivered` puro subestima (o bounce sai do numerador e nunca entra no denominador). |
| 3 | **Bloqueio imediato ao cruzar 2%**: Produto pediu; Supervisor de Backend vetou por falso positivo. | **Bloqueio exige três condições simultâneas** (§2.3): volume mínimo, taxa alta na janela longa **e** na janela curta, e **duas leituras consecutivas** separadas por ≥15 min. Um único disparo ruim de baixo volume não bloqueia ninguém. |
| 4 | **Desbloqueio automático no mesmo limiar (2%)**: causaria *flapping* (bloqueia/desbloqueia a cada hora). | **Histerese**: bloqueia em ≥2%, só volta sozinho abaixo de **1,2%** e com volume novo mínimo. |
| 5 | **Bloqueio via `Team.isBlocked`** (campo já existente): Backend propôs reusar; Supervisor vetou. | **Campo próprio** (`sendingBlockedReason`/`sendingBlockedAt`). `isBlocked` hoje é o bloqueio comercial/manual do admin e é limpo pelo `payment-service` ao confirmar pagamento (`apps/web/src/server/billing/payment-service.ts:132`) — um pagamento **desbloquearia uma conta com problema de reputação**. Bugs de segurança nascem exatamente assim. |
| 6 | **Onde o bloqueio é aplicado**: só no worker (onde já existe checagem de limite) vs também no ingresso. | **Os dois** (§2.5). No ingresso a API responde 403 com mensagem clara; no worker o gate fica como rede de segurança fail-closed. Só no worker, o cliente veria e-mails "FAILED" sem entender o motivo. |
| 7 | **Tom da comunicação**: track de Produto escreveu "sua conta foi punida"; Supervisor de Produto reprovou. | Copy **educativa e de parceria**: explica o porquê (proteção da entregabilidade de todos), o que fazer, e sempre oferece o caminho de volta. Nenhum e-mail acusatório. |

---

## 1. Faixa de tolerância e estados

Taxa de retorno (bounce rate) da janela = `hardBounced / (delivered + hardBounced) × 100`, considerando apenas **hard bounce**. Soft bounce/`DELIVERY_DELAYED` não conta (é transitório e o SES reenvia).

| Estado | Faixa | Efeito |
|---|---|---|
| `HEALTHY` | < 0,4% | Nada. Bloco verde no dashboard. |
| `WARNING` | 0,4% – 0,99% | Alerta amarelo no painel + e-mail educativo (1x/72h). |
| `CRITICAL` | 1% – 1,99% | Alerta laranja + banner persistente + e-mail urgente (1x/24h). Envio **continua liberado**. |
| `BLOCKED` | ≥ 2% (com as travas de §2.3) | Novos disparos bloqueados. Painel 100% acessível. |
| `SUPERVISED` | — | Liberação assistida concedida pelo admin: envio volta com teto diário reduzido (padrão 500/dia) para provar recuperação. |
| `EXEMPT` | — | Time na allowlist (ex.: contas em migração acompanhadas pelo suporte). Nunca bloqueia; alertas continuam. |

`INSUFFICIENT_DATA` é um estado transversal: volume abaixo do mínimo → exibe a taxa com o rótulo "amostra pequena" e **nunca** bloqueia.

Reclamação (spam complaint) permanece com os limiares atuais (`COMPLAINED_WARNING_RATE` 0,1% / `COMPLAINED_RISK_RATE` 0,5%) e entra na mesma máquina de estados como gatilho independente — a mesma engine, política separada. Uma conta pode ser bloqueada por reclamação sem estar em bounce alto.

---

## 2. Backend

### 2.1 Fonte de dados
`DailyEmailUsage` (`teamId, domainId, date, type`) já contabiliza `delivered`, `bounced`, `hardBounced`, `complained` por dia e por tipo (`TRANSACTIONAL`/`MARKETING`). É a fonte da janela. Granularidade diária é suficiente para a janela de 30 dias; para a **janela curta** (§2.3) usamos contagem sobre `EmailEvent`/`Email` das últimas N mensagens com veredito.

Nenhum backfill é necessário: `DailyEmailUsage` já está populado. A engine nasce com histórico.

### 2.2 Cálculo
```
ReputationService.computeSnapshot(teamId, { policy }) -> {
  windowDays, delivered, hardBounced, bounceRate,
  shortWindow: { size, delivered, hardBounced, bounceRate },
  complaintRate, state, sampleSufficient,
  topBounceDomains: [{ domain, count, share }],
  topBounceReasons: [{ code, label, count }],   // usa packages/lib/src/constants/ses-errors.ts
  computedAt
}
```
- Cache em Redis, TTL 300s, chave `reputation:snapshot:{teamId}`; invalidada quando um webhook de bounce do SES é processado (`ses-hook-parser`) — assim a UI reage em minutos, não em horas.
- Cálculo agregado em SQL (`SUM` sobre `DailyEmailUsage` com `date >= hoje-29`), custo O(dias × domínios), irrelevante.
- Por domínio: mesma função com filtro `domainId`, usada na tela de detalhes. **O bloqueio é sempre por time**, porque a reputação no SES é da conta/tenant, não do domínio.

### 2.3 Regra de bloqueio (à prova de falso positivo)
Bloqueia se **todas** forem verdadeiras:
1. `delivered + hardBounced ≥ 500` na janela de 30 dias **e** `hardBounced ≥ 10` (piso absoluto — 2 bounces em 100 envios não é sinal);
2. `bounceRate30d ≥ 2%`;
3. `bounceRateCurto ≥ 2%` nas últimas **1.000** mensagens com veredito (prova que o problema é **atual**, não um resíduo de 25 dias atrás);
4. a condição se repetiu em **duas avaliações consecutivas** com ≥15 min de intervalo (contador em Redis, `reputation:confirm:{teamId}`, TTL 60 min);
5. o time não está `EXEMPT`.

Falta qualquer uma → no máximo `CRITICAL`.

### 2.4 Desbloqueio
- **Automático**: `bounceRate30d < 1,2%` **e** `bounceRateCurto < 1,2%` **e** ≥ 200 novas entregas com veredito desde o bloqueio. Sem volume novo, não há prova de recuperação — a taxa cairia só por decaimento da janela. Estado vai para `HEALTHY`/`WARNING` conforme a faixa.
- **Manual (admin)**: `BLOCKED → SUPERVISED` com teto diário e prazo (padrão 500/dia por 7 dias). Se durante a supervisão a taxa voltar a ≥2% com volume mínimo, volta a `BLOCKED` imediatamente (sem as duas leituras — já houve reincidência) e o admin recebe alerta.
- Todo desbloqueio manual exige **motivo textual obrigatório** e vai para a auditoria (`audit-service`).

### 2.5 Aplicação do bloqueio (dois gates)
**Gate de ingresso** — `POST /v1/emails`, `POST /v1/emails/batch`, SMTP, agendamento/execução de campanha e automações:
- resposta `403` com `{ code: "SENDING_BLOCKED_BOUNCE_RATE", message, bounceRate, threshold, docsUrl, supportUrl }`;
- campanha `RUNNING` ou `SCHEDULED` é movida para `PAUSED` (status já existe no enum) com nota — **nada é perdido**, o cliente retoma depois do desbloqueio;
- e-mails já enfileirados permanecem em `QUEUED`, não são marcados `FAILED`.

**Gate de execução** — `executeEmailJob` em `apps/web/src/server/service/email-queue-service.ts:409` já chama `LimitService.checkEmailLimit`. Adiciona-se `LimitReason.EMAIL_BOUNCE_BLOCKED`. Diferença de tratamento: nos limites atuais o job vira `FAILED`; no bloqueio por bounce o job é **reagendado** (backoff de 1h, até 24h) e só depois vira `FAILED` com motivo explícito. Assim uma janela curta de bloqueio não destrói uma campanha em curso.

**Fail-closed**: o estado vive em coluna do `Team` (não só em cache). Se o Redis cair, a leitura vai ao banco e o bloqueio continua valendo. O inverso — engine indisponível para *calcular* — nunca bloqueia ninguém novo (fail-open no cálculo, fail-closed na aplicação).

**Nunca bloqueados**, mesmo com a conta em `BLOCKED`: e-mails do próprio sistema (OTP de login, códigos de MFA, avisos de bloqueio, faturamento) — enviados por `mailer.ts`/`security-mailer.ts`, fora da fila de time. Um cliente bloqueado não pode ficar sem conseguir entrar no painel. Esse é o requisito de segurança mais crítico da spec.

### 2.6 Modelo de dados (migration versionada — `prisma migrate deploy` em produção)
```prisma
model ReputationPolicy {          // 1 linha global (id=1) + overrides por time
  id              Int      @id @default(autoincrement())
  teamId          Int?     @unique          // null = política global
  windowDays      Int      @default(30)
  shortWindowSize Int      @default(1000)
  minVolume       Int      @default(500)
  minBounces      Int      @default(10)
  warningRate     Decimal  @default(0.4)
  criticalRate    Decimal  @default(1.0)
  blockRate       Decimal  @default(2.0)
  unblockRate     Decimal  @default(1.2)
  autoBlock       Boolean  @default(false)  // shadow mode no rollout
  supervisedLimit Int      @default(500)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model TeamReputationState {
  teamId          Int      @id
  state           ReputationState @default(HEALTHY)
  bounceRate      Decimal
  complaintRate   Decimal
  sampleSize      Int
  blockedAt       DateTime?
  blockedReason   String?
  supervisedUntil DateTime?
  supervisedLimit Int?
  lastEvaluatedAt DateTime
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
}

model ReputationEvent {          // trilha imutável de transições
  id         String   @id @default(cuid())
  teamId     Int
  fromState  ReputationState
  toState    ReputationState
  bounceRate Decimal
  sampleSize Int
  actor      String            // "system" | "admin:{userId}"
  reason     String?
  createdAt  DateTime @default(now())
  @@index([teamId, createdAt(sort: Desc)])
}

enum ReputationState { HEALTHY WARNING CRITICAL BLOCKED SUPERVISED EXEMPT }
```
Em `Team`: `sendingBlockedAt DateTime?` e `sendingBlockedReason String?` (**não** reusar `isBlocked` — decisão #5).

### 2.7 Avaliação periódica
Job BullMQ `reputation-evaluation`, a cada 10 min, sobre times com envio nas últimas 48h (nunca varredura completa). Mais duas entradas: após processar lote de webhooks de bounce do SES e sob demanda quando o admin abre a ficha do time. Idempotente: transição só grava `ReputationEvent` se o estado mudou.

---

## 3. Módulo Admin (`/admin/reputation`)

1. **Réguas** — formulário da política global (todos os campos de `ReputationPolicy`), com preview: "com estes valores, N times entrariam em bloqueio hoje". Nunca salvar uma régua sem mostrar o impacto.
2. **Times em risco** — tabela ordenada por taxa: time, plano, taxa 30d, taxa curta, volume, estado, dias no estado. Filtros por estado.
3. **Ficha do time** — série histórica da taxa, breakdown por domínio e por motivo de bounce, timeline de `ReputationEvent`, e ações: **Bloquear**, **Desbloquear**, **Liberar supervisionado** (teto + prazo), **Isentar** (com validade). Toda ação pede motivo e grava auditoria.
4. **Simulador** — "se eu aplicar esta régua, quem é afetado" antes de mudar qualquer coisa em produção.

Permissão: apenas admin da plataforma (mesmo gate de `admin.ts`). Ver e-mails que quicaram é acesso a dado pessoal de terceiro → registrado em auditoria (LGPD, art. 37 — registro das operações de tratamento).

---

## 4. UX do cliente

**Bloco de bounce no dashboard** (evolução de `reputation-metrics.tsx`): mantém o número grande e o gráfico, e ganha:
- barra de faixas com marcadores em 0,4% / 1% / 2% e a posição atual;
- badge de estado com a semântica de cor já existente (`text-success` / `text-warning` / `text-destructive`) — monocromático, cor só onde comunica risco;
- linha de contexto honesta: *"1,3% — acima do recomendado. O bloqueio ocorre a partir de 2%."* ou, sem amostra, *"amostra pequena (120 entregas) — a taxa ainda oscila muito."*;
- link **"Ver detalhes da entregabilidade →"**.

**Página `/reputation`** (nova):
- estado atual, janela usada e **distância explícita do bloqueio** ("faltam 0,7 ponto percentual");
- **por que isso importa**, em uma frase sem jargão;
- breakdown: domínios que mais quicam, motivos (`ses-errors.ts`), últimos endereços — com ação de exportar e de adicionar à supressão;
- **plano de ação** em 4 passos concretos (higienizar lista, ativar double opt-in — já existe no produto, parar de importar listas compradas, reduzir cadência), cada um com link para a tela correspondente;
- histórico de estados (a `ReputationEvent`, humanizada).

**Quando bloqueado**: banner persistente no topo de todo o dashboard, tom de parceria — *"Envios pausados. Sua taxa de retorno chegou a 2,4%, acima do limite de 2%. Seu painel, contatos e relatórios continuam aqui. Veja como voltar a enviar."* + botão para `/reputation` e para o suporte. Botões de envio ficam desabilitados **com tooltip explicando** — nunca um botão que falha em silêncio. Campanhas pausadas aparecem com selo "pausada por reputação" e retomam sozinhas ao desbloquear.

Acessibilidade: estado nunca comunicado só por cor (ícone + texto); banner com `role="status"`; contraste AA em ambos os temas.

---

## 5. Régua de e-mails

Todos com `sendMail(..., "suporte@madmail.com.br")`, para todos os usuários do time, com cooldown atômico em Redis (`SET NX EX`, padrão já usado em `TeamService.maybeNotifyEmailLimitReached`).

| # | Gatilho | Cooldown | Assunto | Essência |
|---|---|---|---|---|
| 1 | `HEALTHY → WARNING` | 72h | "Sua taxa de retorno subiu um pouco" | Informativo. Número, o que costuma causar, 2 links. Sem alarme. |
| 2 | `WARNING → CRITICAL` | 24h | "Atenção: sua taxa de retorno está perto do limite" | Urgência real + plano de ação + quanto falta para 2%. |
| 3 | `→ BLOCKED` | 1x por bloqueio | "Seus envios foram pausados — veja como retomar" | O que aconteceu, o que **continua funcionando** (painel, dados, campanhas salvas), o caminho de volta, contato do suporte. |
| 4 | Enquanto `BLOCKED` | a cada 72h, máx. 3 | "Ainda podemos te ajudar a voltar a enviar" | Retomada, não cobrança. |
| 5 | `BLOCKED → SUPERVISED` | 1x | "Seus envios foram liberados em modo assistido" | Teto diário, prazo, o que acontece se piorar de novo. |
| 6 | `→ HEALTHY` vindo de `CRITICAL`/`BLOCKED`/`SUPERVISED` | 1x | "Sua taxa de retorno voltou ao normal" | Reconhecimento. Sem "não faça de novo". |

Interno (Discord, via `sendToDiscord`): toda transição para `BLOCKED` e todo desbloqueio manual, com link direto para a ficha do time no admin.

Regra de copy validada pelo Supervisor de Produto: **nenhum e-mail atribui culpa**; todos dizem o número, a faixa e o próximo passo. Todos citam que o acesso ao painel está mantido.

---

## 6. API pública e MCP

**API** (Hono + zod-openapi, seguindo `apps/web/src/server/public-api/api/analytics/`):
- `GET /v1/reputation/status` → estado, taxas, janela, amostra, limiares aplicados, `blockedAt`, `distanceToBlock`;
- `GET /v1/reputation/timeseries?days=30&domainId=` → série diária de entregas/bounces/taxa;
- `GET /v1/reputation/bounce-breakdown?days=30&groupBy=domain|reason` → top ofensores;
- `GET /v1/reputation/events?limit=50` → histórico de transições do próprio time;
- headers informativos `X-Madmail-Reputation-State` e `X-Madmail-Bounce-Rate` nas respostas de envio, para o cliente reagir por integração;
- erro `403 SENDING_BLOCKED_BOUNCE_RATE` documentado no OpenAPI (`apps/docs/api-reference/openapi.json`) e em `apps/docs/`.

**MCP**: novo escopo `reputation:read` em `McpScopes` (`mcp-key-service.ts`), com as tools `reputation_status`, `reputation_bounce_breakdown` e `reputation_events` sobre os mesmos endpoints — o LLM enxerga a saúde da conta sem acesso a conteúdo de e-mail. Tools somente-leitura; nenhuma ação de bloqueio/desbloqueio é exposta por MCP (decisão do Supervisor de Backend: ação destrutiva não vai para agente autônomo).

---

## 7. Rollout

1. **Shadow mode (14 dias)** — `autoBlock = false`. Engine calcula, grava eventos, alimenta admin e Discord. **Ninguém é bloqueado.** Objetivo: medir quantos times *teriam* sido bloqueados e caçar falso positivo antes que ele custe um cliente.
2. **Alertas ao cliente** — liga e-mails 1, 2 e 6 e a UI. Ainda sem bloqueio.
3. **Bloqueio** — `autoBlock = true`, precedido de aviso por e-mail a toda a base com 15 dias de antecedência e atualização da Política de Uso Aceitável (`legal/politica-de-uso-aceitavel.md` e a página em `apps/marketing`) declarando explicitamente a faixa de 0,4% a 2% e o direito de pausar envios. Sem essa cláusula publicada, o bloqueio é contratualmente frágil.
4. **Supervisão** — modo assistido e automações de recuperação.

**Testes obrigatórios**: unitários do cálculo (incluindo divisão por zero, volume insuficiente, histerese, confirmação em duas leituras); integração dos dois gates (ingresso e worker); teste explícito de que **e-mail de sistema atravessa o bloqueio**; teste de que pagamento confirmado **não** limpa bloqueio de reputação (regressão da decisão #5).

**Observabilidade**: métrica de times por estado, contador de bloqueios/desbloqueios por dia, alerta se >2% da base for bloqueada em 24h (sinal de régua errada, não de clientes ruins) — nesse caso a engine entra em *circuit breaker* e para de bloquear até revisão humana.

---

## 8. Critérios de aceite

- Um time com 300 entregas e 9 bounces (3%) **não** é bloqueado (volume insuficiente) e vê "amostra pequena".
- Um time com 50.000 entregas e 2,1% de bounce nas duas janelas é bloqueado em ≤25 min, com e-mail #3 entregue e banner no painel.
- Time bloqueado consegue: entrar no painel, ver relatórios, exportar contatos, gerenciar supressões, pagar fatura, abrir suporte. Não consegue: enviar por API, SMTP, campanha ou automação.
- Campanha em curso no momento do bloqueio fica `PAUSED` e retoma do ponto correto após o desbloqueio, sem duplicar destinatário.
- Recuperação para 1,0% com 200+ entregas novas desbloqueia sozinha em ≤25 min, com e-mail #6.
- Toda ação de admin tem motivo e aparece na auditoria e na timeline do time.
- `GET /v1/reputation/status` e as tools MCP retornam o mesmo estado que a UI mostra.
