# Madmail — Documento Final de Produto: "Meu Perfil", Convites, Exclusão de Conta e MFA
**Para: CEO · De: Direção de Produto · Consolidação dos tracks UX, Segurança, Copy e Backend (todos aprovados em 2 rodadas de supervisão adversarial — Gauntlet Loop de 13/08/2026)**

---

## Conflitos entre tracks e como foram resolvidos

Antes das seções, as cinco divergências encontradas e a decisão final de cada uma — o restante do documento já reflete essas decisões:

| # | Conflito | Decisão |
|---|---|---|
| 1 | **Método de MFA**: Segurança e UX especificaram MFA por código de e-mail; Backend e Copy escreveram para TOTP (QR code, app autenticador, `mfaSecret`) | **MFA por e-mail no v1.** TOTP e passkeys viram roadmap declarado na UI. O `mfaSecret`/QR do plano backend é descartado; a copy do bloco e do e-mail (b) foi reescrita (ver §4 e §5). Motivo: produto sem senha, canal de identidade é o e-mail; TOTP dobraria o escopo sem fechar a ameaça principal (sessão OAuth comprometida). |
| 2 | **Formato do código**: UX = 5 caracteres; Segurança = 6 dígitos | **5 caracteres**, igual ao OTP de login já existente — um único componente de input, uma única expectativa do usuário. Regras criptográficas da Segurança mantidas (HMAC+pepper, TTL 10 min, 5 tentativas). |
| 3 | **Troca de e-mail**: UX/Segurança = dois códigos in-app (double-opt-in); Copy/Backend = link por e-mail | **Dois códigos in-app** (stepper). Link fica só na **reversão** enviada ao e-mail antigo (token de 32 bytes). Janela de reversão: **7 dias** (Segurança), não 30 (Copy). |
| 4 | **Confirmação de exclusão de conta**: Copy/Segurança pediam digitar "EXCLUIR"; UX argumentou que o OTP prova mais | **Só OTP** (ou sessão elevada). Digitação de nome fica apenas na exclusão de **time**, onde confirma *qual* recurso, não identidade. |
| 5 | **Estratégia de sessão**: Segurança desenhou para JWT (`jti`, Redis, `sessionsValidFrom`); Backend **verificou no código** que o projeto usa database sessions (PrismaAdapter sem `strategy`) | **Database sessions vence** (é fato verificado, não opinião). Estado de MFA vive na row de `Session` (`mfaVerifiedAt`); a maquinaria de `jti`/promoção via Redis é descartada. O princípio fail-closed da Segurança é mantido no gate. Bônus: listagem de "Sessões ativas" do UX fica viável no v1 (há tabela). |

Também unificados: armazenamento de códigos por `HMAC-SHA256(código, pepper)` fora do banco (Segurança > sha256 do Backend); 10 recovery codes (não 8); convite expira em 7 dias em todos os textos.

---

## 1. Visão geral da seção "Meu Perfil" (`/profile`)

Rota nova no dashboard, mesma casca visual das settings. Monocromático; vermelho **apenas** em ações destrutivas. Entrada pelo menu do avatar, item "Meu Perfil" no topo.

Blocos, em ordem, numa coluna de cards:

1. **Seus dados** — Nome (auto-save no blur, Esc desfaz, vazio restaura o anterior, "Salvo ✓" com `aria-live`) + E-mail read-only com botão "Alterar" (fluxo em §1.1 abaixo). Sem badge "Verificado" — login por OTP já verifica tudo.
2. **Convites pendentes** — condicional; só renderiza se houver invite para o e-mail da sessão. Aceitar/Recusar inline.
3. **Times** — nome, badge Admin/Membro, "Membro desde {data}", "Sair do time" (vermelho, com confirmação) e ponte "Gerenciar time →" nas linhas Admin. Último admin não sai: tooltip orienta transferir ou excluir o time. Empty state com "Criar time".
4. **Autenticação** — E-mail (código) "sempre ativo"; Google/GitHub com Vincular/Desvincular; badge "e-mail diferente" quando o e-mail do provider divergir do e-mail de acesso. Subcard **Sessões ativas**: lista de dispositivos (viável com database sessions), "Encerrar" por sessão e "Sair de todos os dispositivos".
5. **Confirmação por e-mail em logins sociais** — o MFA, com nome honesto (§4). Roadmap de passkeys/TOTP declarado no card.
6. **Zona de perigo** — Excluir conta (§3).

Regras transversais: **sessão elevada** (um OTP eleva por 10 min; ações sensíveis seguintes não repedem código — exceção: o OTP ao e-mail *novo* na troca nunca é dispensado); acessibilidade completa (focus trap, `alertdialog` destrutivo sem foco no botão vermelho, input de OTP único com `autocomplete="one-time-code"`); loading destrutivo com timeout de 20s — nunca modal-prisão; skeleton e erro de carga por bloco.

**1.1 Troca de e-mail (double-opt-in, decisão #3):** stepper de 3 passos — (1) código ao e-mail **atual** (pulado se sessão elevada), (2) digitar o novo e-mail com avisos sobre providers vinculados, (3) código ao e-mail **novo** (nunca dispensado). No commit: troca atômica, derruba as outras sessões preservando a atual, e-mail ao endereço antigo com link "Reverter" válido por 7 dias. Na reversão: volta o e-mail, derruba todas as sessões e remove qualquer conta OAuth vinculada após a troca (snapshot). Durante os 7 dias, nova troca e exclusão de conta ficam bloqueadas.

---

## 2. Jornada "Convidar membro" (incl. upgrade do FREE)

1. **Descoberta honesta do limite**: em Settings → Time, hint permanente "1 de 1 membros no plano Free". No limite, o botão muda de rótulo: **"Fazer upgrade para convidar"** (com cadeado) — nunca um "Convidar" que abre venda, nunca botão desabilitado sem explicação.
2. Clique → modal de upgrade com copy contextual ("Convide membros ilimitados no plano Basic") → checkout.
3. Retorno com `?intent=invite`: parâmetro de **uso único** (consumido via `router.replace`), que só reabre o dialog de convite após **reconfirmar o plano no servidor**. Pagamento pendente → banner "Pagamento em processamento", sem reexecução cega; recusado → modal reapresentado com o erro.
4. Dialog de convite: e-mail + papel → "Enviar convite". Lista mostra "Enviado há X", Reenviar, Cancelar. Self-hosted mantém "Copiar convite".
5. **Aceite endurecido (PR0, sai antes de tudo)**: o aceite exige `invite.email === session.email` (case-insensitive); rechecagem do limite do plano **contando membros direto no banco** no momento do aceite; invites deixam de ser enumeráveis por id. Se o limite bloquear o aceite: o convidado vê tela dedicada "aguarda liberação do administrador", o admin recebe badge "Bloqueado por limite" + e-mail de upgrade; regularizado, o convidado recebe e-mail de liberação e o mesmo link entra.
6. Convite expira em **7 dias** e é invalidado após o uso. Convites pendentes ao e-mail antigo **não migram** na troca de e-mail.

---

## 3. Jornada "Excluir conta" (incl. logs para o administrador)

1. **Pré-condições**: nenhum vínculo de time, nenhuma troca de e-mail na janela de 7 dias, sem assinatura ativa (cloud).
2. **Checklist 100% inline**: se houver bloqueios, o dialog abre em modo checklist e **tudo se resolve sem sair dele** — sair de time (membro, confirmação curta), **transferir administração** (select de membro + "Transferir e sair", operação atômica) ou **excluir o time** (sub-fluxo com nome do time digitado + OTP). Caso dono-solo (o mais comum no FREE): fluxo único **"Excluir time e conta"** com **um código só**, graças à sessão elevada.
3. **Confirmação final**: lista de perdas + **um OTP por e-mail** (decisão #4 — sem "digite EXCLUIR"). Dispensado se a sessão foi elevada há <10 min neste encadeamento.
4. **Execução** (transação com advisory lock por usuário, TOCTOU fechado): audit `account_deleted` gravado **antes** de destruir qualquer coisa; delete de Accounts OAuth, todas as Sessions, invites pendentes ao e-mail, códigos; **pseudonimização** do User (`deleted+<subjectId>@…`, nome/imagem nulos, `deletedAt`). Hard delete da linha após 30 dias por job. Terminologia honesta LGPD: é pseudonimização (art. 13 §4º), base legal do resíduo é segurança/prevenção à fraude (art. 7º IX e 10), retenção do audit por 12 meses com purge.
5. Sessões em voo: `protectedProcedure` rejeita `deletedAt != null`. Aceite de convite recusa conta excluída, serializado pela mesma lock.
6. **Logs para o administrador**: aba **/admin → Auditoria** — tabela paginada de `UserAuditLog` com filtros por evento/e-mail/período, metadata expandível, eventos destrutivos com badge vermelha. Eventos críticos (MFA on/off, e-mail trocado/revertido, conta excluída, invite aceito, saída de time, impersonate) gravados **dentro da transação** — se o log falhar, a operação aborta. O e-mail fica como snapshot no log e é **zerado** após a pseudonimização; a correlação sobrevive via `subjectId` aleatório (+ `HMAC(email, pepper)` quando necessária). Impersonate é auditado e **bloqueia** ações de segurança. Reset de MFA por suporte: two-person rule + 72h de cooldown com link de cancelamento pelo usuário.

---

## 4. Lógica do MFA por e-mail — honesta

**Nome no produto: "Confirmação por e-mail em logins sociais."** Não chamamos de "verificação em duas etapas": o desafio usa o mesmo canal da identidade — quem controla a caixa de entrada passa por tudo. O valor real, e é assim que a copy explica: **proteger a conta quando o Google/GitHub do usuário for comprometido** — mesmo com o OAuth aprovado, a sessão só nasce após código no e-mail. Roadmap declarado no card: passkeys e app autenticador.

**Ativação**: "Ativar" → código ao e-mail (nunca dispensado pela sessão elevada — a prova de recebimento é pré-requisito funcional, evita lockout) → ativa, gera 10 recovery codes exibidos uma vez, e-mail de aviso. Desativar exige código (ou sessão elevada). Sem provider social vinculado, o card não mostra toggle morto: CTA "Vincular Google ou GitHub".

**Login**:
- **Por e-mail (OTP)**: inalterado — **o caso login-por-e-mail satisfaz o MFA por definição**, pois o primeiro fator já é a posse da caixa; um segundo código ao mesmo endereço não adicionaria nada. Isso fica documentado na UI, e o OTP de login herda o mesmo rate limiting/lockout.
- **Por Google/GitHub**: mecânica fail-closed sobre database sessions (decisão #5): o wrap de `adapter.createSession` cria a sessão com `mfaVerifiedAt = null` e um `MfaChallenge` amarrado ao `sessionToken` (TTL 10 min). Layout do dashboard e `protectedProcedure` rejeitam sessão pendente (só verificação/reenvio/recovery/logout passam), redirecionando a `/mfa-challenge`. Verificação correta → `mfaVerifiedAt = now()` na row. Cada dispositivo tem seu próprio desafio — verificação nunca vaza entre sessões. Recovery code entra no mesmo lockout (10 falhas/hora → 15 min). Teste automatizado obrigatório: sessão pendente não acessa nada.

Criptografia: códigos de 5 caracteres, single-use, TTL 10 min, armazenados como `HMAC-SHA256(código, pepper)` com pepper em env/KMS — dump do banco é inútil. Cotas de envio separadas por finalidade; o "phantom send" anti-enumeração nunca consome cota do dono.

---

## 5. Template de convite — texto final (íntegra)

**Assunto:** `{nomeConvidante} convidou você para o time {nomeTime} na Madmail`

**Preheader:** `Aceite o convite e comece a enviar e-mails com o time {nomeTime}. O link expira em 7 dias.`

**Corpo:**

> **Você foi convidado para um time**
>
> Olá,
>
> **{nomeConvidante}** ({emailConvidante}) convidou você para participar do time **{nomeTime}** na Madmail — a plataforma brasileira para envio de e-mails transacionais e campanhas.
>
> Ao aceitar, você terá acesso aos domínios, contatos e envios do time, de acordo com a sua função.
>
> **[Aceitar convite]**
>
> Este convite expira em **7 dias**. Se o botão não funcionar, copie e cole este endereço no navegador:
> `{urlConvite}`
>
> **Não esperava este e-mail?**
> Se você não conhece {nomeConvidante} ou não quer participar deste time, basta ignorar esta mensagem. Nenhuma ação será feita na sua conta sem o seu aceite.

**Rodapé:**

> Enviado por **Madmail** · madmail.com.br
> Você recebeu este e-mail porque {nomeConvidante} convidou {emailConvidado} para um time na Madmail.

Datas em todos os transacionais no padrão pt-BR: `13/08/2026, às 14h32` (locale global do date-fns já configurado). Nota: a copy do e-mail (b) do track Copy, escrita para TOTP, será adaptada para "código enviado ao seu e-mail em logins com Google/GitHub" antes da implementação (decisão #1).

---

## 6. Arquitetura técnica resumida

**Premissa verificada**: NextAuth v4 com PrismaAdapter e **database sessions**. Toda mudança de schema via `prisma migrate dev` com migration versionada — nunca `db push` (regra do projeto).

**Modelos Prisma (novos/alterados):**
- `User`: + `subjectId` (cuid único, correlação pós-delete), `mfaEnabled`, `mfaEnabledAt`, `pendingEmail` (com unique parcial via SQL na migration), `deletedAt`.
- `Session`: + `mfaVerifiedAt` e `elevatedAt` (sessão elevada de 10 min, server-side).
- `SecurityCode` (purpose: MFA_LOGIN, MFA_ENABLE, EMAIL_CHANGE_CURRENT, EMAIL_CHANGE_NEW, EMAIL_CHANGE_REVERT, ACCOUNT_DELETE; `codeHmac` com pepper versionado, TTL, attempts, consumo atômico). Não reutiliza `VerificationToken` do NextAuth.
- `MfaChallenge` (amarrado a `sessionToken` unique), `MfaRecoveryCode` (10, HMAC), `MfaResetRequest` (two-person + 72h).
- `EmailChangeRequest` (oldEmail, newEmail, confirmações, `revertDeadline`, `oauthAccountsSnapshot` — remediação por estado, nunca derivada do log).
- `UserAuditLog` (evento, ator, alvo, `targetSubject`, e-mail snapshot anulável, ip/UA, metadata; índices por alvo, evento e data).
- `TeamInvite`: + índice por `email`.

**Rotas/superfícies:** `/profile`; `/mfa-challenge` (fora do gate); router tRPC `user.ts` (getProfile, updateName, requestEmailChange/confirmEmailChange, enable/confirm/disableMfa, verifyMfaChallenge, request/confirmAccountDeletion, listLinkedAccounts, listSessions/revokeSession/revokeAllSessions); `admin.listAuditLogs`; helper `getCurrentSessionRow` (cookie → row, ambas variantes de nome); helper `rateLimit` em Lua atômico (INCR+EXPIRE juntos); advisory lock `pg_advisory_xact_lock(LOCK_NS_USER_LIFECYCLE, hashtext(userId))` em deleção × aceite de convite. Remetente de sistema explícito para todos os e-mails de segurança — nunca o fallback "primeiro time do banco".

**Ordem de PRs:**
- **PR0 — hardening de invites** (fix de aceite + enumeração; sai antes de tudo, fecha a corrida com troca de e-mail).
- **PR1 — migrations completas** + serviço de audit transacional + rate limit Lua.
- **PR2 — router básico + `/profile` read-only** + resolução de sessão corrente.
- **PR3 — troca de e-mail** double-opt-in + reversão + e-mails (testes: token alheio, P2002 concorrente, replay, retry pós-rollback, sessões derrubadas preservando a atual).
- **PR4 — MFA por e-mail** (wrap de createSession, gate fail-closed, `/mfa-challenge`, recovery codes, feature flag `MFA_ENABLED`; teste de regressão: segundo dispositivo exige código próprio).
- **PR5 — exclusão de conta** + aba Auditoria + lock/`deletedAt` no aceite + reset de MFA por suporte.
- **PR6 — sessão elevada + sessões ativas na UI + convite com upgrade (`?intent=` de uso único)**.

---

## 7. Riscos aceitos e trade-offs

1. **MFA por e-mail tem ponto único de falha (a caixa postal)** — aceito conscientemente; por isso o nome honesto na UI e o roadmap público de passkeys/TOTP. Não vendemos "duas etapas".
2. **Login por e-mail não recebe segundo desafio** — correto tecnicamente (mesmo fator), mas um usuário pode achar que "ativou MFA" e não vê-lo no login diário. Mitigação: explicação explícita no card.
3. **Assunto do e-mail de código começando pelo código** — trade-off de entregabilidade aceito (padrão Google/Slack); alternativa registrada se filtros punirem.
4. **Sessão elevada de 10 min** reduz fricção mas amplia levemente a janela de uma sessão roubada; aceito porque a alternativa (fadiga de OTP) degrada a segurança real, e a troca de e-mail nunca dispensa a prova do endereço novo.
5. **Pseudonimização + hard delete em 30 dias** em vez de hard delete imediato — resíduo tratado como dado pessoal, base legal documentada, purge de audit em 12 meses; direito de eliminação adicional atendível por `subjectId`.
6. **`ADMIN_EMAIL` como identidade de admin é frágil** — bloqueio duplo na troca de e-mail mitiga; migração para flag `isAdmin` fica como dívida registrada.
7. **Códigos de 5 caracteres** (espaço menor que 6 dígitos alfanumérico à parte) — compensado por HMAC+pepper, single-use, 5 tentativas e lockout; consistência de UX valeu o trade.
8. **Reset de MFA por suporte existe** (engenharia social possível) — mitigado por two-person rule, 72h de cooldown e cancelamento pelo próprio usuário; aceito como necessário para não gerar lockouts irrecuperáveis.
9. **Aceite bloqueado por limite cria estado intermediário** (convidado "aguardando") — mais complexidade, mas escolhido em vez de erro seco que queimaria o convite pago pelo admin.
