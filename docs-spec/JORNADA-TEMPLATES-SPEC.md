# Spec — Templates na jornada de campanha

Resultado do gauntlet de 13/08/2026 (3 especialistas + 3 supervisores, 2
ciclos de revisão), consolidado pelo Diretor de Produto. UX e PM aprovados
pelos supervisores; as 6 objeções restantes da Microcopy foram resolvidas
nesta consolidação (ver §6).

## 0. Fato que motiva tudo

Templates são uma funcionalidade completa (criar, editar, duplicar) e a
jornada de campanha **não faz nenhuma referência a eles**. `Template.content`
e `Campaign.content` usam o MESMO JSON do editor — a ponte é cópia de
conteúdo. O maior ponto de abandono é o lojista caindo no canvas branco com
25 blocos e a instrução implícita "monte do zero".

## 1. Decisão de arbitragem (UX × PM divergiram no ponto de entrada)

- UX propôs: modal de criação intocado; seleção no editor vazio (overlay).
- PM propôs: grade de templates opcional no próprio modal + `templateId` no
  `createCampaign`.

**Decisão: a jornada da UX vence; a infraestrutura do PM fica.** O modal
acabou de ganhar alerta de domínio e o campo De guiado — é decisão de
conteúdo sem preview num funil que já cresceu. A seleção acontece no editor,
onde há espaço para miniatura. Consequência boa: **não muda a API de criação**
(`templateId` no `createCampaign` morre; aplicar template é update de
conteúdo pelo caminho de autosave que já existe).

Do PM ficam as três contribuições estruturais: templates padrão do sistema,
semântica do assunto e critério de "doc vazio".

## 2. A jornada final

**Modal de criação — INTOCADO.** Nada de texto novo (objeção 5 da copy: o
modal já tem uma frase de reasseguro; duas empilhadas é poluição).

**Editor vazio — overlay de estado vazio no canvas.**
- Aparece sse `isDocEmpty(json) && !campaign.templateOfferDismissedAt`.
- `isDocEmpty`: função pura — doc sem nenhum nó de texto não vazio e sem nós
  ≠ `paragraph`/`doc` (o parágrafo vazio que o TipTap autosalva conta como
  vazio). Resolve a objeção 4 (critério concreto, não "content == null").
- `templateOfferDismissedAt: DateTime?` em Campaign (migration versionada).
  Gravado ao: escolher template, clicar "Começar em branco", digitar, ou
  soltar bloco. Overlay não volta depois de dispensado.
- Overlay é `pointer-events: none` exceto nos botões — o drop da paleta
  atravessa e cai no editor; o `onUpdate` desmonta o overlay e grava o flag
  junto do autosave (sem request extra).
- CTA primário (preto): **"Usar um template"** → abre o painel.
- CTA secundário (ghost): **"Começar em branco"**.

**Painel de templates — `Sheet` lateral direito (primitivo já existente).**
- Lista: "Seus templates" + "Templates do Madmail" (os padrão do sistema).
- Item: nome + assunto como fallback textual imediato; miniatura por cima
  quando pronta (render server-side cacheado por `updatedAt`, iframe sandbox
  lazy; só os 8 primeiros renderizam de cara, resto ao rolar).
- Busca por nome (visível com >6), ordenação por mais recente, rodapé
  "Gerenciar templates →" (link normal, nunca o caminho recomendado).
- **Assunto** (objeções 1 e 2 resolvidas): como o assunto é OBRIGATÓRIO na
  criação, ele nunca está vazio — o checkbox "Substituir o assunto pelo do
  template" fica **desmarcado por padrão**, abaixo da lista, com o assunto do
  template exibido. Em template sem assunto, o checkbox some (nada de nota
  fixa prometendo comportamento que não vale para todos os itens).
- Clique no template: aplica `content` via `setContent` (transação única no
  history), aplica assunto conforme o checkbox, grava o flag, fecha o sheet.
  1 clique do overlay ao e-mail montado.

**Editor com conteúdo — entrada permanente.**
- Botão ghost **"Usar template"** no EmailHeaderBar, alinhado à direita na
  linha do Assunto. Ao lado, **"Salvar como template"** (o ciclo virtuoso que
  alimenta a biblioteca sem sair do fluxo).
- **Sem dialog de confirmação** ao sobrescrever: a aplicação é uma transação
  única de undo. No lugar (objeções 3 e 6): **barra inline não-efêmera** no
  topo do canvas — "Template aplicado." (+ " Assunto atualizado." quando for
  o caso) com botão **"Desfazer"** — que restaura conteúdo E assunto a partir
  de um snapshot do componente (`previousContentRef` + assunto anterior), e
  permanece até a próxima edição. Nada de toast de 8s prometendo undo que
  expira.

**Zero templates — eliminado por produto.**
- Seed de 5 templates pt-BR de varejo (o `default-templates.ts` já existe
  para isso): `Template.teamId` vira `Int?` + `isDefault Boolean` (migration
  única), padrão com `teamId = null`. Endpoint read-only
  `template.defaultTemplates` (`where: { isDefault: true, teamId: null }`) —
  ineditável por qualquer time porque as mutations filtram por `teamId` do
  contexto. Ninguém jamais vê o painel vazio; contas antigas veem os padrão
  + CTA "Criar meu primeiro template".

## 3. Microcopy final (pt-BR, tom do produto)

| Local | Texto |
|---|---|
| Overlay título | "Comece com um e-mail pronto" |
| Overlay subtítulo | "Escolha um template e troque só os textos e as fotos." |
| CTA primário | "Usar um template" |
| CTA secundário | "Começar em branco" |
| Sheet título | "Templates" |
| Busca | "Buscar template…" |
| Grupos | "Seus templates" / "Templates do Madmail" |
| Checkbox assunto | "Substituir o assunto pelo do template" (desmarcado) |
| Barra pós-aplicação | "Template aplicado. — Desfazer" |
| Com assunto trocado | "Template aplicado. Assunto atualizado. — Desfazer" |
| Estado sem templates próprios | "Você ainda não criou templates. Estes são os do Madmail — use e edite à vontade." + CTA "Criar meu primeiro template" |
| Header (com conteúdo) | "Usar template" / "Salvar como template" |

Terminologia: **"template"**, coerente com o menu lateral que já diz
"Templates". Renomear tudo para "modelo" é decisão separada — meio a meio é
pior que qualquer um dos dois.

## 4. Ordem de implementação

1. Migration: `Campaign.templateOfferDismissedAt` + `Template.teamId Int?` +
   `Template.isDefault` + seed dos padrão. (uma migration)
2. `isDocEmpty` puro + testes.
3. Endpoint `template.defaultTemplates` + preview HTML cacheado.
4. Overlay de estado vazio + Sheet.
5. Entradas no EmailHeaderBar ("Usar template" / "Salvar como template") +
   barra de Desfazer.
6. Miniaturas (podem entrar depois — o fallback textual segura a primeira
   versão).

## 5. Rejeitados (com motivo, para ninguém reabrir sem novo argumento)

- Seleção no modal de criação — decisão sem preview, funil já denso.
- Passo obrigatório "Escolha um template" (padrão Mailchimp) — pune o
  recorrente; proibido pela regra de zero passos novos.
- Auto-aplicar o último template usado — risco de enviar conteúdo da campanha
  anterior por engano; catastrófico em e-mail.
- Dialog de confirmação ao sobrescrever — redundante com undo de transação
  única; substituído pela barra persistente.
- Toast com ação de desfazer — decisão de conteúdo em componente efêmero.

## 6. Vereditos do gauntlet

- UX: aprovado (2 revisões).
- PM: aprovado (2 revisões).
- Microcopy: reprovado no teto de revisões; as 6 objeções do supervisor foram
  incorporadas na consolidação (§2 e §3) — todas eram inconsistências com o
  design aprovado, não problemas de tom.
