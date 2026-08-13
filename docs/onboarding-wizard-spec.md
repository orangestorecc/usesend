# Spec — Wizard de Onboarding e UX de Ativação (Madmail)

Status: proposta · Autor: Diretor de Produto · Data: 2026-08-13

## 1. Decisão de formato: Sessão interna + Modal de boas-vindas

**Veredito: página interna `/onboarding` (fonte da verdade) + modal só no primeiro login.**

Por quê (o modal puro foi descartado):

| Critério | Modal | Sessão interna |
|---|---|---|
| Etapa de DNS leva horas/dias | ❌ modal morre no refresh | ✅ estado persistido, volta quando quiser |
| Precisa copiar registros p/ outra aba | ❌ modal bloqueia a tela | ✅ navegação livre |
| Baixar PDF, abrir docs, chamar suporte | ❌ atrito | ✅ natural |
| Impacto de "primeira impressão" | ✅ forte | ⚠️ precisa de empurrão |

Solução híbrida:
1. **Modal de boas-vindas** (uma vez, primeiro login): 1 tela, 3 frases, botão "Bora configurar" → leva a `/onboarding`. Dispensável, nunca reaparece.
2. **`/onboarding`** — página real com o checklist de 5 passos, cada passo em Accordion expansível, com a ação executada *inline* (sem sair da página).
3. **Widget persistente** no sidebar (ver §5) até 100%.

Regra de ouro do design: o lojista nunca vê a palavra "DKIM" antes de precisar. Linguagem de resultado ("Provar que o e-mail é seu"), com o termo técnico em letra menor abaixo.

## 2. A jornada — 5 passos

| # | Passo | Concluído quando | Bloqueia o seguinte? |
|---|---|---|---|
| 1 | Escolher o domínio de envio | existe `Domain` no time | sim |
| 2 | Validar o domínio (DNS) | `Domain.status = SUCCESS` | **sim (trava dura)** |
| 3 | Criar sua primeira lista | existe `ContactBook` | não (liberado desde o início) |
| 4 | Adicionar contatos | ≥1 `Contact` na lista | não |
| 5 | Criar e disparar a 1ª campanha | existe `Campaign` com status ≥ SCHEDULED | sim (depende de 2 e 4) |

Passos 3 e 4 ficam **destravados desde o começo** de propósito: enquanto o DNS propaga (horas), o usuário tem o que fazer. Isso é o que evita o abandono clássico de "wizard sequencial trava no DNS".

### Passo 1 — a recomendação do subdomínio
Card com duas opções, a recomendada em destaque:
- ✅ **`envios.sualoja.com.br`** (recomendado) — "Não mexe no e-mail que você já usa. Se algo der errado, seu `contato@` continua funcionando normalmente."
- ⚠️ **`sualoja.com.br`** — "Usar o domínio principal mistura seus e-mails de marketing com os pessoais. Um problema de reputação afeta os dois."

Campo com prefixo pré-preenchido `envios.` e o usuário só digita o domínio.

### Passo 2 — onde todo mundo trava
Três saídas, sempre visíveis lado a lado:
1. **"Eu mesmo configuro"** → registros DNS com botão copiar por linha (já existe em `domains/[domainId]/page.tsx`) + accordion "Como fazer no meu provedor" (Registro.br, GoDaddy, Hostinger, Cloudflare, Locaweb, KingHost).
2. **"Meu técnico configura"** → **baixar instruções** (`.md` e `.pdf`) — §4.
3. **"Preciso de ajuda"** → link do chat de suporte + `/docs/dominios`.

Polling automático de verificação a cada 30s enquanto a página está aberta, + botão "Verificar agora". Ao virar `SUCCESS`: confete + toast "Domínio validado! Agora você pode enviar e-mails."

### Gamificação
Barra de progresso (0/5) no topo. Ao concluir cada passo: check verde animado + microcópia de parabéns específica do passo (não genérica). Ao chegar em 5/5: tela de conclusão com resumo do que ele construiu e CTA para o dashboard. O widget do sidebar some para sempre.

## 3. Regras de negócio — travas

### 3.1 Double opt-in sem domínio validado
Hoje: `contact-service.ts:138` chama `sendDoubleOptInConfirmationEmail` sempre; sem domínio o envio falha silenciosamente e o contato fica pendente para sempre.

Novas regras:

| Situação | Comportamento |
|---|---|
| Criar contato, lista com double opt-in ON, **sem domínio verificado** | Contato é criado com `subscribed = false`. **Não tenta enviar.** Banner na lista: "N contatos aguardando confirmação. Valide seu domínio para enviar os pedidos." + CTA para `/onboarding` |
| Ícone de reenvio individual (`resend-double-opt-in-confirmation.tsx`) | `disabled` + Tooltip: "Valide seu domínio de envio para pedir a confirmação deste contato." + link |
| Novo: **envio em massa** de pedidos de opt-in na lista | Botão só habilita com domínio verificado. Enfileira em lote os contatos `subscribed = false` que nunca receberam pedido ou cujo último pedido tem >24h. Respeita limite de plano. Mostra "X pedidos enviados" |
| Domínio acabou de ser validado | Banner muda para CTA verde: "Pronto! Enviar os N pedidos de confirmação agora" |

Ponto crítico de segurança (auditado): a trava **não pode ser só de UI**. `sendDoubleOptInConfirmationEmail` (`double-opt-in-service.ts:49`) deve, na primeira linha, checar se o time tem `Domain.status = SUCCESS` compatível com o `from` e lançar erro tipado caso contrário. UI desabilitada é conveniência; o serviço é a trava real.

Anti-abuso do envio em massa: rate limit por lista (1 disparo em massa a cada 15 min) e cooldown de 24h por contato, para não virar ferramenta de spam.

### 3.2 Campanha sem lista
Hoje: `create-campaign.tsx` não pede lista; o erro só aparece no `scheduleCampaign`.

Mudanças:
1. **Modal de criar campanha passa a exigir a lista** — Select obrigatório de `ContactBook` no schema zod, acima do assunto. Mostra a contagem de contatos inscritos em cada lista no próprio Select.
2. Se o time não tem nenhuma lista: o Select vira um estado vazio com "Criar minha primeira lista" (cria inline, sem perder o formulário).
3. `campaign.create` passa a aceitar e persistir `contactBookId`; o campo continua editável no editor.
4. Botão "Agendar"/"Enviar" fica `disabled` com tooltip explicando o que falta (sem lista / sem contatos inscritos / sem domínio validado / falta link de descadastro), em vez de deixar clicar e falhar. As validações de servidor em `campaign-service.ts:340-470` permanecem intactas.

## 4. Instruções técnicas exportáveis (.md e .pdf)

Gerado por `/api/domains/[domainId]/instructions?format=md|pdf`, com os valores reais dos registros. Estrutura:

```markdown
# Configuração de DNS — envios.sualoja.com.br

Olá! Sou responsável pela loja **Sua Loja** e preciso adicionar
alguns registros de DNS para conseguir enviar e-mails pela Madmail.

Se você cuida do domínio **sualoja.com.br**, pode seguir os passos abaixo.
Leva cerca de 10 minutos. Nada aqui afeta o site ou os e-mails atuais.

## Registros a adicionar

### 1. Autenticação DKIM (3 registros CNAME)
| Tipo | Nome / Host | Valor | TTL |
|---|---|---|---|
| CNAME | xxxx._domainkey.envios | xxxx.dkim.amazonses.com | 3600 |
(...)

### 2. SPF (TXT)
### 3. DMARC (TXT)
### 4. Recebimento — MX (opcional)

## Observações importantes
- Não remova registros SPF/MX já existentes — veja "conflitos" abaixo.
- Alguns provedores adicionam o domínio ao "Nome" automaticamente:
  se o painel já mostra `.sualoja.com.br` no fim, digite só `xxxx._domainkey.envios`.
- A propagação leva de 15 minutos a 24 horas.

## Como confirmar que deu certo
Avise o responsável pela loja: no painel da Madmail o domínio
passa a exibir "Validado" automaticamente.

## Dúvidas
Documentação: https://docs.madmail.com.br/dominios
Suporte: suporte@madmail.com.br
---
Gerado em 13/08/2026 pela Madmail.
```

O PDF é o mesmo conteúdo com a marca. Botão "Enviar por e-mail ao meu técnico" (campo de e-mail) como atalho — usa o domínio transacional da Madmail, então funciona mesmo sem o domínio do cliente validado.

## 5. Persistência do lembrete

**Estado:** novo campo `Team.onboardingState Json?` (o schema não tem nenhum Json em `Team` hoje) guardando `{ dismissedWelcomeAt, completedAt, lastStepSeen, snoozedUntil }`.

**Progresso é derivado, não gravado.** `team.getOnboardingProgress` calcula os 5 passos por contagem real (domínio verificado, lista, contatos, campanha) — mesmo padrão do `account-deletion-service.ts:33`. Assim não existe estado dessincronizado se o usuário fizer as coisas fora do wizard.

**Superfícies:**
1. **Sidebar** (`AppSideBar.tsx`, bloco no `SidebarFooter`): card compacto "Configuração 2/5" + barra de progresso + "Continuar". Sempre visível, nunca bloqueia.
2. **Primeiro login da sessão** (não a cada page load): se `< 5/5` e passaram >20h desde o último lembrete, abre um **toast persistente** com "Você parou no passo 3 — continuar?" / "Depois". Escolhemos toast em vez do modal recorrente: modal toda vez vira irritação e o usuário aprende a fechar sem ler.
3. **Dashboard vazio**: enquanto 0 campanhas enviadas, o card de checklist aparece no topo de `dashboard/page.tsx`, acima do `KpiStrip`.
4. **"Não mostrar mais"**: sempre disponível. Grava `snoozedUntil = +30 dias`; o card do sidebar encolhe para um ícone discreto, mas não some — o usuário pode voltar.

## 6. Arquivos a criar/alterar

**Criar**
- `apps/web/prisma/migrations/<ts>_team_onboarding_state/` — `Team.onboardingState Json?`
- `apps/web/src/server/service/onboarding-service.ts` — cálculo dos 5 passos
- `apps/web/src/server/api/routers/onboarding.ts` — `getProgress`, `dismissWelcome`, `snooze`
- `apps/web/src/app/(dashboard)/onboarding/page.tsx` + `steps/*.tsx`
- `apps/web/src/components/OnboardingWidget.tsx`, `WelcomeDialog.tsx`
- `apps/web/src/app/api/domains/[domainId]/instructions/route.ts` — md/pdf
- `apps/web/src/server/service/dns-instructions.ts` — gerador do conteúdo
- `apps/docs/guides/dominios.mdx` — passo a passo por provedor

**Alterar**
- `double-opt-in-service.ts:49` — trava de servidor por domínio verificado
- `contact-service.ts:138,323` — não tentar enviar sem domínio; marcar pendente
- `contacts.ts` (router) — mutation `sendBulkDoubleOptIn`
- `resend-double-opt-in-confirmation.tsx` — disabled + tooltip explicativo
- `contact-list.tsx` — banner de pendentes + botão de envio em massa
- `create-campaign.tsx:35-45,95-194` — Select de lista obrigatório
- `campaign.ts` (router) + `campaign-service.ts` — aceitar `contactBookId` na criação
- `schedule-campaign.tsx` — disabled com motivo em vez de erro pós-clique
- `dasboard-layout.tsx` / `AppSideBar.tsx` — slot do widget
- `prisma/schema.prisma` — `Team.onboardingState`

## 7. Auditoria dos supervisores — pontos que mudaram a spec

- **UX:** wizard 100% sequencial foi rejeitado — travava tudo no DNS. Passos 3 e 4 liberados desde o início.
- **UX:** modal recorrente a cada login rejeitado (fadiga) → toast com no máximo 1 lembrete/20h + "não mostrar mais" real.
- **Engenharia:** trava de opt-in só na UI rejeitada — a checagem tem que estar no `double-opt-in-service`, senão a API pública contorna.
- **Engenharia:** progresso gravado em banco rejeitado — derivado por contagem, imune a dessincronização.
- **Engenharia:** envio em massa exige rate limit e cooldown por contato, senão vira vetor de spam.
- **Copy:** nada de "DKIM/SPF" antes do passo 2; termo técnico sempre subordinado ao resultado.
