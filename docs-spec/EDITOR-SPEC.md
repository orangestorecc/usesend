# SPEC TÉCNICA — Reformulação do Editor de E-mail (Madmail)

Status: proposta (não implementada).
Escopo do documento: pacote `packages/email-editor` e app `apps/web`.
Base verificada em: commit `093702a` (branch `main`).

---

## 1. Contexto e objetivo

### 1.1 O que existe hoje (verificado no código)

**Componente raiz** — `packages/email-editor/src/editor.tsx`:

```ts
export type EditorProps = {
  onUpdate?: (content: TipTapEditor) => void;
  onCreate?: (editor: TipTapEditor) => void;
  initialContent?: Content;
  variables?: Array<string>;
  uploadImage?: UploadFn;
  variableSuggestionsHelperText?: string;
};
```

O `Editor` renderiza apenas `<EditorContent>`, `<TextMenu>` e `<LinkMenu>` dentro de uma `div` com classes `bg-white rounded-md text-black p-4 sm:p-8 unsend-editor light`. Não há trilho, paleta de blocos, painel lateral nem cabeçalho de e-mail.

**Extensões** — `packages/email-editor/src/extensions/index.ts`, função `extensions({ variables, uploadImage, variableSuggestionsHelperText })`. Inclui `PageStyleDocument`, `StarterKit` (com `dropcursor: { color: "#555", width: 3 }` já configurado), `SlashCommand`, `GlobalDragHandle`, e os nodes customizados:

| Extensão | Arquivo | Node `name` | Comando |
|---|---|---|---|
| `SectionExtension` | `extensions/SectionExtension.ts` | `section` | `setSection()` |
| `ColumnsExtension` / `ColumnExtension` | `extensions/ColumnsExtension.ts` | `columns` / `column` | `setColumns(count?)` |
| `ButtonExtension` | `extensions/ButtonExtension.ts` | `button` | `setButton()` |
| `SpacerExtension` | `extensions/SpacerExtension.ts` | `spacer` | `setSpacer()` |
| `HtmlExtension` | `extensions/HtmlExtension.ts` | `html` | `setHtmlBlock()` |
| `SocialLinksExtension` | `extensions/SocialLinksExtension.ts` | `socialLinks` | `setSocialLinks()` |
| `YoutubeExtension` / `TwitterExtension` / `ChartExtension` | `extensions/EmbedExtensions.ts` | `youtube` / `twitter` / `chart` | `setYoutube()` / `setTwitter()` / `setChart()` |
| `ResizableImageExtension` | `extensions/ImageExtension.tsx` | `image` | `setImage({ src })` |
| `VariableExtension` | `extensions/VariableExtension.ts` | `variable` | via suggestion `{{` |
| `UnsubscribeFooterExtension` | `extensions/UnsubsubscribeExtension.tsx` | `unsubscribeFooter` | inserção HTML no slash |
| `PageStyleDocument` | `extensions/PageStyleExtension.ts` | `doc` (topNode) | `setPageStyle(style)` |

**NodeViews** em `packages/email-editor/src/nodes/`: `section.tsx`, `columns.tsx`, `button.tsx`, `spacer.tsx`, `html.tsx`, `image-resize.tsx`, `social-links.tsx`, `embeds.tsx`, `variable.tsx`, `unsubscribe-footer.tsx`. O padrão atual de edição de atributos é um `Popover` do `@usesend/ui/src/popover` disparado por um `Settings2Icon` dentro do próprio NodeView (ver `nodes/section.tsx`).

**Menu `/`** — `packages/email-editor/src/extensions/SlashCommand.tsx`: `DEFAULT_SLASH_COMMANDS(uploadImage)` retorna ~24 itens do tipo `SlashCommandItem` (`title`, `description`, `searchTerms`, `icon`, `command`, `section`, `shortcut`), agrupados por `section` em "Texto", "Mídia", "Layout", "Utilitário". O `CommandList` renderiza tudo num container `no-scrollbar h-auto max-h-[330px] overflow-y-auto`.

**Renderer** — `packages/email-editor/src/renderer.tsx`, classe `EmailRenderer`. `renderNode()` faz dispatch por nome do node (`if (type in this) return this[type]?.(...)`) e **lança** `Error(\`Node type "${type}" is not supported.\`)` para nodes desconhecidos; idem `renderMark()` para marks. `markup()` lê `this.email.attrs?.pageStyle` e aplica em `<Body>` (backgroundColor, fontFamily, margin: 0) e `<Container>` (maxWidth = `contentWidth || "600px"`, minWidth 300px, width 100%, margin auto, padding "0.5rem", backgroundColor = `contentBackground`).

**Toolbar** — `apps/web/src/components/editor-toolbar.tsx` (`EditorToolbar({ editor })`): dois popovers, "Estilo da página" (fundo da página, fundo do conteúdo, largura entre 560/600/680, fonte) e "Gerar com IA" (`api.ai.generateEmail`). Está ligada **apenas** em `apps/web/src/app/(dashboard)/campaigns/[campaignId]/edit/page.tsx` (~linha 450), passando `editorInstance` capturado via `onCreate`. Em `apps/web/src/app/(dashboard)/templates/[templateId]/edit/page.tsx` (~linha 201) o `Editor` é montado **sem** toolbar e **sem** `onCreate`.

**IA** — `apps/web/src/server/api/routers/ai.ts`: `aiRouter` com `generateEmail({ prompt, tone? }) -> { html }` e `rewrite({ text, instruction }) -> { text }`, ambos `teamProcedure`, chamando a API da Anthropic (`MODEL = "claude-sonnet-5"`, exige `env.ANTHROPIC_API_KEY`).

**UI disponível** — `packages/ui/src/`: `button`, `popover`, `select`, `tabs`, `dialog`, `input`, `label`, `switch`, `table`, `tooltip`, `separator`, `sheet`, `dropdown-menu`, `accordion`, `badge`, `textarea`, `avatar`, `command`, `sidebar`, `skeleton`, `spinner`, `card`, `charts`.

**Dependências** (`packages/email-editor/package.json`): TipTap 2.11.7 (`@tiptap/core`, `react`, `pm`, `starter-kit`, `suggestion`, extensões), `jsx-email` 2.8.4, `lucide-react` 0.503, `react-colorful` 5.6.1, `tippy.js` 6.3.7, `shiki`, `tiptap-extension-global-drag-handle` 0.1.18 — **observação**: o pacote npm está declarado mas o drag handle efetivamente usado é a implementação local `extensions/dragHandle.ts` (cópia adaptada), importada como `GlobalDragHandle`.

### 1.2 Problemas

1. **Descoberta de blocos ruim**: todos os blocos só existem atrás do `/`. Com `max-h-[330px]` e ~24 itens, as seções "Layout" e "Utilitário" ficam fora da área visível sem rolagem. Usuário novo não sabe que existem colunas, seção, social, chart.
2. **Page style é um popover pequeno**: `editor-toolbar.tsx` expõe 4 propriedades num popover `w-72`. O alvo (Resend) tem um painel lateral persistente com ~12 controles, e contextual por bloco.
3. **Templates não tem toolbar**: `templates/[templateId]/edit/page.tsx` monta `Editor` sem `onCreate`, logo não há instância disponível e nenhum controle de page style/IA nessa tela.
4. **Cabeçalho fraco**: hoje a página de template tem apenas um `input` de assunto solto acima do editor; não há From, Reply-To, Preview text, badge de status, nem ações "Pick a template"/"Upload HTML".
5. **Edição de atributos dispersa**: cada NodeView tem seu próprio popover de configuração, com layouts diferentes; não há um lugar único e previsível.

### 1.3 Objetivo

Aproximar a experiência do editor do Madmail à do Resend, com três blocos de interface novos (trilho+paleta à esquerda, painel de propriedades à direita, cabeçalho de e-mail no miolo) e **superar** o Resend em um ponto: os blocos da paleta serão **arrastáveis** para dentro do documento (drag and drop), além de clicáveis.

---

## 2. Escopo

### 2.1 Entra

- Trilho vertical esquerdo (modos: início, edição, código HTML).
- Paleta flutuante de blocos com flyouts por categoria (Texto, Mídia, Layout/Blocos, Variáveis).
- Drag and drop de blocos da paleta para o documento, com indicador de destino.
- Painel direito contextual: "Page style" quando não há seleção de node; propriedades do bloco quando há.
- Extensão do `pageStyle` com novos atributos + suporte correspondente no `renderer.tsx`.
- Cabeçalho do e-mail no miolo (From / Reply-To / Subject / Preview text / badge de status / ações).
- Menu de contexto por bloco (Editar com IA, Transformar em, Mover, Duplicar, Excluir).
- Integração de IA no placeholder e no menu de bloco, reusando `aiRouter`.
- Ligar o novo chrome também na tela de templates.

### 2.2 Não entra

- Reescrever o `renderer.tsx` para outra biblioteca (segue `jsx-email`).
- Trocar TipTap 2.x por 3.x.
- Novos tipos de bloco além dos já existentes (a única exceção é o eventual `divider`/`text` já cobertos).
- Editor de tema global ("Edit theme") e "Global CSS" — na v1 os dois itens do rodapé do painel ficam presentes mas **desabilitados** (a confirmar com o cliente se entram na fase 5).
- Colaboração em tempo real, histórico de versões, A/B.
- Mudança do modelo de dados persistido (continua `JSONContent` do TipTap nas tabelas de template/campanha).

---

## 3. Arquitetura proposta

### 3.1 Divisão de responsabilidades

Princípio: **tudo que depende só do TipTap fica em `packages/email-editor`; tudo que depende de tRPC, sessão, roteamento ou dados de campanha/template fica em `apps/web`.**

| Parte | Onde | Motivo |
|---|---|---|
| Trilho + paleta + drag and drop | `packages/email-editor/src/chrome/` | depende só de `editor` |
| Painel direito (page style + props de bloco) | `packages/email-editor/src/panels/` | depende só de `editor` |
| Cabeçalho From/Subject/Preview | `apps/web/src/components/editor/` | depende de dados do domínio (domínios verificados, contact book, status) |
| Botão Publish, avatar, menu "..." | `apps/web` | depende de sessão e mutations |
| Ações de IA (chamada) | `apps/web` via callback injetado | `api.ai.*` só existe no app |
| Ações de IA (UI/gatilho) | `packages/email-editor` | recebe `onAiRequest` por prop |

### 3.2 Novo layout do `Editor`

`packages/email-editor/src/editor.tsx` passa a renderizar um shell de 3 colunas (CSS grid), controlado por props novas. Assinatura proposta (aditiva, tudo opcional — nenhuma quebra nas chamadas atuais):

```ts
export type EditorMode = "edit" | "code";

export type AiRequest =
  | { kind: "generate"; prompt: string }
  | { kind: "rewrite"; text: string; instruction: string };

export type AiResult = { html?: string; text?: string };

export type EditorProps = {
  // existentes
  onUpdate?: (content: TipTapEditor) => void;
  onCreate?: (editor: TipTapEditor) => void;
  initialContent?: Content;
  variables?: Array<string>;
  uploadImage?: UploadFn;
  variableSuggestionsHelperText?: string;

  // novos (todos opcionais)
  /** Liga trilho + paleta esquerda. Default: false na v1, true a partir da fase 6. */
  showBlockPalette?: boolean;
  /** Liga painel direito de propriedades/page style. */
  showPropertiesPanel?: boolean;
  /** Slot renderizado acima do canvas (cabeçalho From/Subject). */
  header?: React.ReactNode;
  /** Slot renderizado no topo do painel direito (avatar, "...", Publish). */
  panelHeaderSlot?: React.ReactNode;
  /** Slot no rodapé do painel ("Edit theme", "Global CSS"). */
  panelFooterSlot?: React.ReactNode;
  /** Executor de IA injetado pelo app; ausente => UI de IA some. */
  onAiRequest?: (req: AiRequest) => Promise<AiResult>;
  /** Texto do placeholder do corpo. */
  placeholder?: string;
  /** Modo controlado do trilho (edit/code). */
  mode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
};
```

### 3.3 Estado compartilhado

- A instância do TipTap continua criada por `useEditor` dentro de `Editor` e exposta ao app por `onCreate` (padrão já usado em `campaigns/[campaignId]/edit/page.tsx` com `setEditorInstance`).
- Dentro do pacote, para evitar prop drilling entre shell, paleta e painel, criar um contexto:
  - `packages/email-editor/src/context/EditorChromeContext.tsx`
  - `EditorChromeProvider` expõe `{ editor, mode, setMode, selection, aiRequest }`.
  - `useEditorChrome()` — hook consumidor.
- **Seleção**: hook `useSelectedNode(editor)` em `packages/email-editor/src/hooks/useSelectedNode.ts`:

```ts
export type SelectedNode = {
  node: ProseMirrorNode;
  pos: number;
  typeName: string;
  attrs: Record<string, unknown>;
} | null;

export function useSelectedNode(editor: TipTapEditor | null): SelectedNode;
```

Implementação: assinar `editor.on("selectionUpdate")` e `editor.on("transaction")`, e derivar:
1. se `editor.state.selection instanceof NodeSelection` → usar `selection.node` e `selection.from`;
2. senão, subir de `selection.$from` até o primeiro ancestral de bloco cujo `type.name` esteja na lista de blocos configuráveis (`section`, `columns`, `column`, `button`, `image`, `spacer`, `html`, `socialLinks`, `youtube`, `twitter`, `chart`, `heading`, `paragraph`, `blockquote`, `codeBlock`, `bulletList`, `orderedList`);
3. se nada, retornar `null` (→ painel mostra Page style).

Re-render controlado com `useSyncExternalStore` ou `useState` + `useEvent` (já existe `packages/email-editor/src/hooks/useEvent.ts`).

### 3.4 Estrutura de arquivos nova (proposta)

```
packages/email-editor/src/
  chrome/
    EditorShell.tsx           # grid 3 colunas
    LeftRail.tsx              # trilho fino (home / edit / code)
    BlockPalette.tsx          # paleta flutuante com 4 botões
    BlockPaletteFlyout.tsx    # lista de blocos de uma categoria
    DraggableBlockItem.tsx    # item arrastável + clicável
    CodeView.tsx              # visão "</>" (HTML gerado, read-only)
  panels/
    PropertiesPanel.tsx       # roteador: page style vs bloco
    PageStylePanel.tsx
    BodyStyleSection.tsx
    blocks/
      ButtonPanel.tsx
      ImagePanel.tsx
      SectionPanel.tsx
      ColumnsPanel.tsx
      SpacerPanel.tsx
      SocialLinksPanel.tsx
      EmbedPanel.tsx          # youtube/twitter/chart
      TextBlockPanel.tsx      # paragraph/heading/list/blockquote
  controls/
    ColorField.tsx
    NumberUnitField.tsx
    BoxModelField.tsx
    SegmentedControl.tsx
  context/
    EditorChromeContext.tsx
  blocks/
    registry.ts               # fonte única de verdade dos blocos
  extensions/
    BlockDropExtension.ts     # plugin PM do drop externo
  menus/
    BlockContextMenu.tsx
  hooks/
    useSelectedNode.ts
```

E em `apps/web`:

```
apps/web/src/components/editor/
  EmailHeaderBar.tsx          # From / Reply-To / Subject / Preview text
  EditorTopActions.tsx        # avatar, "...", Publish
  EditorAiBridge.ts           # adapta api.ai.* para onAiRequest
  PickTemplateDialog.tsx
  UploadHtmlDropzone.tsx
```

### 3.5 Registry de blocos (peça central)

`packages/email-editor/src/blocks/registry.ts` — unifica paleta, menu `/` e "Transformar em", eliminando a duplicação atual (hoje só existe `DEFAULT_SLASH_COMMANDS`).

```ts
export type BlockCategory = "text" | "media" | "layout" | "utility";

export type BlockDefinition = {
  /** id estável, usado no dataTransfer do drag. */
  id: string;
  title: string;
  description: string;
  category: BlockCategory;
  searchTerms: string[];
  icon: React.ReactNode;
  shortcut?: string;
  /** Insere via comando (usado no clique e no slash). */
  insert: (editor: TipTapEditor, at?: number) => void;
  /** JSONContent inserido no drop; ausente => cai no `insert`. */
  toJSON?: () => JSONContent;
  /** true se a inserção abre file picker / prompt (não suporta drop direto). */
  requiresInteraction?: boolean;
};

export const BLOCK_REGISTRY: BlockDefinition[] = [...];
export function getBlock(id: string): BlockDefinition | undefined;
export function blocksByCategory(c: BlockCategory): BlockDefinition[];
```

`DEFAULT_SLASH_COMMANDS` em `SlashCommand.tsx` passa a ser **derivado** do registry:

```ts
const DEFAULT_SLASH_COMMANDS = (uploadImage?: UploadFn): SlashCommandItem[] =>
  BLOCK_REGISTRY.map(toSlashCommandItem(uploadImage));
```

mantendo o tipo `SlashCommandItem` exportado como está (compatibilidade com `getSlashCommandSuggestions(commands, uploadImage)`).

---

## 4. Especificação detalhada

## 4.A — Trilho esquerdo + paleta de blocos

### A.1 Trilho (`chrome/LeftRail.tsx`)

- Coluna fixa, largura 48px, `position: sticky; top: 0; height: 100vh`, borda direita 1px.
- Três botões (ícones `lucide-react`, 20px), empilhados no topo, com `Tooltip` do `@usesend/ui/src/tooltip`:
  1. `HomeIcon` — navega para a listagem (callback `onHome?: () => void`; se ausente, botão oculto).
  2. `PencilIcon` — `mode = "edit"` (ativo por padrão; estado visual: fundo `bg-muted`, ícone em contraste alto).
  3. `CodeIcon` (`</>`) — `mode = "code"`.
- Props:

```ts
type LeftRailProps = {
  mode: EditorMode;
  onModeChange: (m: EditorMode) => void;
  onHome?: () => void;
};
```

- Modo `code` (`chrome/CodeView.tsx`): substitui o canvas por um bloco read-only com o HTML final. **Importante**: `EmailRenderer.render()` é assíncrono/server-side (usa `render` do `jsx-email`) e o pacote `email-editor` roda no cliente. Portanto o `CodeView` **não** chama o renderer diretamente; recebe o HTML por prop:

```ts
type CodeViewProps = { html?: string; loading?: boolean; onRefresh?: () => void };
```

Em `apps/web`, o HTML vem da rota já existente `apps/web/src/app/api/to-html/route.ts` (que instancia `EmailRenderer`) — **a confirmar** o contrato exato dessa rota antes da implementação. Alternativa de fallback: mostrar `editor.getHTML()` (HTML do ProseMirror, não do e-mail final) com aviso explícito de que é uma prévia estrutural.

### A.2 Paleta (`chrome/BlockPalette.tsx`)

- Container flutuante: `position: absolute`, colado à direita do trilho, verticalmente centralizado no canvas; `rounded-2xl border bg-background shadow-lg p-1 flex flex-col gap-1`.
- 4 botões quadrados 36x36:

| Botão | Ícone | Categoria |
|---|---|---|
| `T` | `TypeIcon` | `text` |
| Imagem | `ImageIcon` | `media` |
| Blocos | `LayoutGridIcon` | `layout` |
| `(x)` | `VariableIcon` | `utility` (variáveis, HTML, unsubscribe, divisor) |

- Clicar abre `BlockPaletteFlyout` à direita, via `Popover` (`@usesend/ui/src/popover`) com `side="right"` e `align="start"`. Apenas um flyout aberto por vez (estado local `openCategory: BlockCategory | null`).
- O flyout **não** tem `max-height` restritivo: `max-h-[70vh] overflow-y-auto` — resolve o problema do `max-h-[330px]` do slash.

Itens do flyout de texto (categoria `text`), na ordem alvo do Resend, com o mapeamento para o registry:

| Rótulo | `BlockDefinition.id` | Comando |
|---|---|---|
| Texto | `paragraph` | `toggleNode("paragraph", "paragraph")` |
| Título (H1) | `heading1` | `setNode("heading", { level: 1 })` |
| Subtítulo (H2) | `heading2` | `setNode("heading", { level: 2 })` |
| Cabeçalho (H3) | `heading3` | `setNode("heading", { level: 3 })` |
| Lista com marcadores | `bulletList` | `toggleBulletList()` |
| Lista numerada | `orderedList` | `toggleOrderedList()` |

### A.3 Drag and drop (requisito do cliente)

**Mecanismo**: HTML5 drag nativo no item da paleta + um plugin ProseMirror para tratar `dragover`/`drop` vindos de fora do editor. Não usamos `view.dragging` (que é para arrasto *interno*, como faz `extensions/dragHandle.ts`), porque a origem está fora da view.

**A.3.1 Item arrastável** — `chrome/DraggableBlockItem.tsx`:

```ts
type DraggableBlockItemProps = {
  block: BlockDefinition;
  editor: TipTapEditor;
  onInserted?: () => void;
};
```

Comportamento:

```tsx
<button
  draggable={!block.requiresInteraction}
  onDragStart={(e) => {
    e.dataTransfer.setData("application/x-madmail-block", block.id);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setDragImage(ghostRef.current!, 12, 12);
  }}
  onClick={() => { block.insert(editor); onInserted?.(); }}
/>
```

- O MIME customizado `application/x-madmail-block` evita colisão com o drag interno do `dragHandle.ts`, que usa `text/html` e `text/plain`.
- **Preview do arrasto**: um elemento oculto (`ghostRef`) renderizado fora da tela (`position:fixed; top:-1000px`) com o ícone + título do bloco, fundo branco, borda, `rounded-md`, sombra — passado a `setDragImage`. Sem isso o browser usa uma captura do botão, que fica cortada dentro do flyout.
- Blocos com `requiresInteraction: true` (hoje: **Imagem**, que abre `<input type="file">`, e **Variável**, que insere `{{` e depende do suggestion) ficam **não arrastáveis** na v1 — apenas clicáveis. Alternativa futura: arrastar insere um placeholder de imagem vazio e o upload é disparado no drop (fase 6, opcional).

**A.3.2 Plugin de drop** — `extensions/BlockDropExtension.ts`:

```ts
export const BlockDropExtension = Extension.create<{ getBlock: (id: string) => BlockDefinition | undefined }>({
  name: "blockDrop",
  addProseMirrorPlugins() { /* ... */ },
});
```

Plugin ProseMirror com `props.handleDOMEvents`:

- `dragover(view, event)`:
  ```ts
  if (!event.dataTransfer?.types.includes("application/x-madmail-block")) return false;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!coords) return true;
  const pos = insertionPosFor(view, coords, event.clientY);
  view.dispatch(view.state.tr.setMeta(blockDropKey, { pos }));
  return true;
  ```
- `dragleave` / `drop`: limpar o meta (`{ pos: null }`).
- `drop(view, event)`:
  ```ts
  const id = event.dataTransfer?.getData("application/x-madmail-block");
  if (!id) return false;
  event.preventDefault();
  const block = getBlock(id);
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  const pos = coords ? insertionPosFor(view, coords, event.clientY) : view.state.doc.content.size;
  const json = block?.toJSON?.();
  if (json) {
    editor.chain().focus().insertContentAt(pos, json).run();
  } else {
    editor.chain().focus().setTextSelection(pos).run();
    block?.insert(editor, pos);
  }
  return true;
  ```

**A.3.3 Cálculo da posição de soltura** (`insertionPosFor`)

`view.posAtCoords({left, top})` retorna `{ pos, inside }`. Para inserir **entre** blocos (e não no meio de um parágrafo):

1. `const $pos = view.state.doc.resolve(coords.inside >= 0 ? coords.inside : coords.pos)`.
2. Subir até `depth` onde o pai é o `doc` (ou um `section`/`column`, que são containers válidos): `const depth = closestBlockDepth($pos)`.
3. Obter o DOM do bloco alvo via `view.nodeDOM($pos.before(depth))` e seu `getBoundingClientRect()`.
4. Se `event.clientY < rect.top + rect.height / 2` → inserir **antes**: `pos = $pos.before(depth)`; senão **depois**: `pos = $pos.after(depth)`.
5. Documento vazio ou drop abaixo do último bloco → `pos = view.state.doc.content.size`.

**A.3.4 Indicador visual de destino**

O `dropcursor` do StarterKit (`{ color: "#555", width: 3 }`) **só reage a `view.dragging`**, isto é, arrasto interno — não vai aparecer para o drag externo. Portanto o indicador é próprio:

- Um `Decoration.widget(pos, buildLine, { side: -1 })` mantido no `state` do `BlockDropExtension` (via `PluginKey` + `apply(tr, value)` lendo `tr.getMeta(blockDropKey)`).
- `buildLine()` cria uma `div` com classe `madmail-drop-indicator` (altura 3px, `background: #555`, `border-radius: 2px`, `margin: 4px 0`) — CSS em `packages/email-editor/src/styles/index.css`.
- Adicionalmente, classe `madmail-dragging-external` no `view.dom` durante o arrasto para reduzir opacidade do conteúdo e destacar o alvo.

**A.3.5 Interação com o drag handle existente**

`extensions/dragHandle.ts` registra `handleDOMEvents.drop` que lê `view.state.selection instanceof NodeSelection`. No drop externo não haverá `NodeSelection` correspondente, e a função retorna cedo (`if (!droppedNode) return;`), sem efeito colateral. Ainda assim, o `BlockDropExtension` deve ser adicionado **depois** de `GlobalDragHandle` no array de `extensions()` e retornar `true` no `drop` para interromper a cadeia. **A confirmar** em teste manual que a ordem dos `handleDOMEvents` do ProseMirror garante isso; se não garantir, mover o `if` do MIME customizado para o topo do handler do `dragHandle.ts` (mudança mínima).

---

## 4.B — Painel direito de propriedades

### B.1 Estrutura

- Coluna direita, largura 300px, `border-l`, `sticky top-0 h-screen overflow-y-auto`.
- Colapsável: ícone de alternar no cabeçalho do painel; estado persistido em `localStorage` sob a chave `madmail:editor:panel-open` (**a confirmar** se o time prefere persistir por usuário no banco).

`panels/PropertiesPanel.tsx`:

```ts
type PropertiesPanelProps = {
  editor: TipTapEditor;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
```

Lógica: `const selected = useSelectedNode(editor)`. Se `selected === null` → `<PageStylePanel editor={editor} />`. Senão → `PANEL_BY_NODE[selected.typeName] ?? <TextBlockPanel/>`.

`headerSlot` recebe de `apps/web` o `EditorTopActions` (avatar via `@usesend/ui/src/avatar`, `DropdownMenu` "...", botão **Publish** com `variant="default"`).
`footerSlot` recebe os botões "Edit theme" (`PaletteIcon`) e "Global CSS" (`BracesIcon`), desabilitados na v1.

### B.2 Leitura e escrita de atributos

**Bloco selecionado**:

```ts
const attrs = editor.getAttributes(selected.typeName);
const update = (patch: Record<string, unknown>) =>
  editor.chain().focus().updateAttributes(selected.typeName, patch).run();
```

Observação: `updateAttributes(name, attrs)` do TipTap atua sobre o node do tipo informado na seleção atual; se a seleção for texto dentro de um `section`, o TipTap sobe até encontrar o node do tipo. Para nodes atômicos (`button`, `spacer`, `image`, `html`, `socialLinks`, embeds), a seleção já é `NodeSelection` e funciona diretamente. Onde houver ambiguidade (ex.: `column` dentro de `columns`), usar a forma explícita por posição:

```ts
editor.view.dispatch(
  editor.state.tr.setNodeMarkup(selected.pos, undefined, { ...selected.attrs, ...patch })
);
```

**Documento (page style)**:

```ts
const pageStyle = (editor.state.doc.attrs.pageStyle ?? {}) as PageStyle;
const setStyle = (patch: Partial<PageStyle>) =>
  editor.chain().focus().setPageStyle(patch).run();
```

`setPageStyle` já faz merge (`{ ...current, ...style }` via `tr.setDocAttribute`) — ver `extensions/PageStyleExtension.ts`.

### B.3 Novos atributos de `pageStyle`

Hoje (`PageStyleExtension.ts`):

```ts
export type PageStyle = {
  backgroundColor?: string;
  contentBackground?: string;
  contentWidth?: string;
  fontFamily?: string;
};
```

Proposta (aditiva, todos opcionais — documentos antigos continuam válidos):

```ts
export type BoxValue = string | {
  top?: string; right?: string; bottom?: string; left?: string;
};

export type PageStyle = {
  // existentes
  backgroundColor?: string;
  contentBackground?: string;
  contentWidth?: string;
  fontFamily?: string;

  // novos — página
  /** Padding do <Body> (área externa). Default "0". */
  pagePadding?: BoxValue;

  // novos — body/conteúdo (o <Container>)
  /** Alinhamento do conteúdo dentro do body: left | center | right. Default "center". */
  contentAlign?: "left" | "center" | "right";
  /** Cor de texto padrão do e-mail. Default herda do tema. */
  textColor?: string;
  /** Altura do container. Default "auto". */
  contentHeight?: string;
  /** Padding interno do container. Default "0.5rem" (valor atual hardcoded). */
  contentPadding?: BoxValue;
  /** Margin externa do container. Default "auto" horizontal. */
  contentMargin?: BoxValue;
  /** Raio de canto do container. Default "0". */
  contentBorderRadius?: BoxValue;
  /** Espessura de borda do container. Default "0". */
  contentBorderWidth?: BoxValue;
  /** Cor da borda do container. Default "#000000". */
  contentBorderColor?: string;
};
```

Convenções:
- Todo valor dimensional é armazenado **com unidade** (`"16px"`), não como número. O campo de UI separa número e unidade, mas serializa concatenado. Evita ambiguidade no renderer.
- `BoxValue` como string = valor uniforme nos 4 lados; como objeto = por lado. Isso alimenta os "2 botões de box-model" do alvo (lados individuais vs. valor único).
- `contentWidth` continua string com unidade; a UI mostra `600` + dropdown `px | %`.

### B.4 Campos do `PageStylePanel`

Seção **Page style**:

| Campo | Componente | Atributo |
|---|---|---|
| Background | `ColorField` | `backgroundColor` |
| Padding | `NumberUnitField` + `BoxModelField` | `pagePadding` |

Seção **Body** (`BodyStyleSection.tsx`):

| Campo | Componente | Atributo |
|---|---|---|
| Alinhamento | `SegmentedControl` (3 botões) | `contentAlign` |
| Text | `ColorField` | `textColor` |
| Background | `ColorField` | `contentBackground` |
| Width | `NumberUnitField` (`px`/`%`) | `contentWidth` |
| Height | `NumberUnitField` (`auto`/`px`) | `contentHeight` |
| Padding | `NumberUnitField` + `BoxModelField` | `contentPadding` |
| Margin | `NumberUnitField` + `BoxModelField` | `contentMargin` |
| Corner radius | `NumberUnitField` + `BoxModelField` | `contentBorderRadius` |
| Border | `NumberUnitField` + `BoxModelField` | `contentBorderWidth` |
| Border color | `ColorField` | `contentBorderColor` |
| Fonte | `Select` (`@usesend/ui/src/select`) | `fontFamily` |

Controles reutilizáveis (`packages/email-editor/src/controls/`):

```ts
// ColorField.tsx — swatch + hex; reusa ColorPickerPopup de components/ui/ColorPicker.tsx (react-colorful)
type ColorFieldProps = {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange: (hex: string) => void;
};

// NumberUnitField.tsx
type NumberUnitFieldProps = {
  label: string;
  value?: string;              // ex.: "600px" | "auto"
  units?: string[];            // default ["px", "%"]
  allowAuto?: boolean;
  min?: number;
  onChange: (value: string) => void;
};

// BoxModelField.tsx — os 2 botõezinhos do alvo
type BoxModelFieldProps = {
  value?: BoxValue;
  onChange: (value: BoxValue) => void;
  /** rótulos dos 4 lados no modo expandido */
  labels?: [string, string, string, string];
};

// SegmentedControl.tsx
type SegmentedControlProps<T extends string> = {
  value: T;
  options: Array<{ value: T; icon: React.ReactNode; label: string }>;
  onChange: (v: T) => void;
};
```

### B.5 Painéis por bloco

Mapeados aos atributos **já existentes** nas extensões (nenhum atributo novo de bloco nesta spec):

| Node | Painel | Atributos existentes |
|---|---|---|
| `section` | `SectionPanel` | `backgroundColor`, `padding`, `borderRadius`, `align` |
| `columns` / `column` | `ColumnsPanel` | `gap` / `width` |
| `button` | `ButtonPanel` | `text`, `url`, `alignment`, `borderRadius`, `borderWidth`, `borderColor`, `buttonColor`, `textColor` |
| `spacer` | `SpacerPanel` | `height` |
| `image` | `ImagePanel` | `src`, `alt`, `title`, `width`, `height`, `alignment`, `externalLink`, `borderRadius`, `borderColor`, `borderWidth`, `isUploading` |
| `socialLinks` | `SocialLinksPanel` | `links[]`, `align`, `size` |
| `youtube` | `EmbedPanel` | `url`, `align` |
| `twitter` | `EmbedPanel` | `url`, `username`, `text`, `align` |
| `chart` | `EmbedPanel` | `chartType`, `title`, `labels`, `values`, `color`, `align` |
| `html` | `HtmlPanel` | `html` |
| texto (`paragraph`, `heading`, listas, `blockquote`, `codeBlock`) | `TextBlockPanel` | `textAlign`, `level`, cor via mark `textStyle`/`color` |

Os popovers de configuração dentro dos NodeViews (ex.: `Settings2Icon` em `nodes/section.tsx`) **permanecem** na fase inicial e são removidos na fase 7, após o painel cobrir 100% dos atributos — evita regressão de funcionalidade durante a migração.

---

## 4.C — Cabeçalho do e-mail (miolo)

Componente `apps/web/src/components/editor/EmailHeaderBar.tsx`, passado ao `Editor` via prop `header`.

```ts
type EmailHeaderBarProps = {
  breadcrumb: { label: string; href?: string }[];   // ex.: [{label:"Templates", href:"/templates"}, {label:"Sem título"}]
  status?: "draft" | "scheduled" | "sent";           // renderiza <Badge>
  from?: { name?: string; email: string };
  onFromChange?: (v: { name?: string; email: string }) => void;
  replyTo?: string;
  onReplyToChange?: (v: string) => void;
  subject: string;
  onSubjectChange: (v: string) => void;
  previewText?: string;
  onPreviewTextChange?: (v: string) => void;
  onPickTemplate?: () => void;
  onUploadHtml?: (html: string) => void;
};
```

Layout:

1. **Barra superior central**: `Breadcrumb` (`@usesend/ui/src/breadcrumb`, já existe) + `Badge` de status.
2. **Linha From**: à esquerda um campo inline com formato `Nome <email@dominio>`; à direita link discreto **Reply-To** que expande um segundo campo inline. Em campanhas, o valor de `from` vem dos domínios verificados (reusar a lógica já presente em `campaigns/[campaignId]/edit/page.tsx` — **a confirmar** qual componente/query exata é usada hoje para seleção de domínio).
3. **Linha Subject**: input inline (mesmo estilo do atual em templates: `border-b border-transparent focus:border-border bg-transparent`) + link **Preview text** à direita que expande outro campo.
4. Separador fino antes do canvas.
5. **Placeholder do corpo**: configurado via `Placeholder.configure({ placeholder })` — hoje é `"write something on '/' for commands"`. Novo default (pt-BR), passado pela prop `placeholder` do `Editor`:
   `"Pressione '/' para comandos, ou use a IA para escrever seu e-mail"`.
6. **Ações abaixo do placeholder** (só visíveis com documento vazio): `Pick a template` → `PickTemplateDialog.tsx` (lista templates da equipe e faz `editor.commands.setContent(json)`); `Upload HTML ou Ctrl+V` → `UploadHtmlDropzone.tsx` (input file `.html` + handler de paste) que insere via `editor.chain().insertContent(html).run()`.

**Nota de compatibilidade**: `Preview text` já é suportado pelo renderer? O `RenderConfig.preview` existe em `renderer.tsx` mas o `markup()` **não** renderiza `<Preview>` (o import `Preview` do `jsx-email` existe mas está sem uso). Implementar o preview text exige adicionar `{this.config.preview ? <Preview>{this.config.preview}</Preview> : null}` no `markup()` e propagar o valor — ver seção 5.

---

## 5. Mudanças no `renderer.tsx`

Todas em `EmailRenderer.markup()`, `packages/email-editor/src/renderer.tsx`.

### 5.1 Helper de box model

```ts
function boxToCss(v?: BoxValue, fallback?: string): string | undefined {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  const { top = "0", right = "0", bottom = "0", left = "0" } = v;
  return `${top} ${right} ${bottom} ${left}`;
}
```

### 5.2 Mapeamento atributo → CSS

| Atributo `pageStyle` | Elemento | Propriedade CSS | Notas de compatibilidade |
|---|---|---|---|
| `backgroundColor` | `<Body>` | `backgroundColor` | já existe |
| `pagePadding` | `<Body>` | `padding` | Outlook ignora padding em `<body>`; o `jsx-email` `Body` gera `<body>` — para robustez, aplicar também numa `<Container>` externa envolvendo o conteúdo |
| `fontFamily` | `<Body>` | `fontFamily` | já existe |
| `textColor` | `<Body>` **e** nos defaults do tema | `color` | herança de cor é inconsistente em Outlook; a implementação deve sobrescrever `DEFAULT_THEME.colors.paragraph` e `.heading` quando `textColor` estiver definido, garantindo inline em cada `<Text>`/`<Heading>` |
| `contentWidth` | `<Container>` | `maxWidth` | já existe; adicionar também `width` em px para Outlook (`width: contentWidth`) |
| `contentHeight` | `<Container>` | `height` | omitir quando `"auto"` |
| `contentBackground` | `<Container>` | `backgroundColor` | já existe |
| `contentPadding` | `<Container>` | `padding` via `boxToCss` | substitui o `padding: "0.5rem"` hardcoded — **default deve continuar `"0.5rem"`** para não alterar e-mails existentes |
| `contentMargin` | `<Container>` | `margin` | preservar `marginLeft/Right: auto` quando `contentAlign === "center"` |
| `contentAlign` | `<Container>` | `marginLeft`/`marginRight` | `left` → `0/auto`; `center` → `auto/auto`; `right` → `auto/0`. Não usar `textAlign`, que afetaria o texto |
| `contentBorderRadius` | `<Container>` | `borderRadius` | Outlook desktop ignora — degradação aceitável |
| `contentBorderWidth` | `<Container>` | `borderWidth` + `borderStyle: "solid"` | só emitir `borderStyle` quando width > 0 |
| `contentBorderColor` | `<Container>` | `borderColor` | |

### 5.3 Preview text

Adicionar em `markup()`, dentro de `<Body>` e antes do `<Container>`:

```tsx
{this.config.preview ? <Preview>{this.config.preview}</Preview> : null}
```

E permitir configurar `preview` pelo construtor/`render()`:

```ts
constructor(email, options: EmailRendererOption & { preview?: string })
```

**Atenção**: `EmailRenderer` é instanciado em 8 lugares em `apps/web` (ver seção 9.4). A adição precisa ser opcional para não quebrar nenhum call site.

### 5.4 Princípios mantidos

- CSS **sempre inline** nos elementos (o `jsx-email` já emite `style=` inline; o único `<style>` do documento é o reset em `<Head>`).
- Estruturas de layout continuam via `<Container>`/`<Row>`/`<Column>` do `jsx-email`, que geram tabelas.
- Nenhum atributo novo pode alterar o output quando ausente — todos os defaults reproduzem exatamente o HTML atual.

---

## 6. Integração da IA

### 6.1 Ponte app → pacote

`apps/web/src/components/editor/EditorAiBridge.ts`:

```ts
export function useAiRequest(): (req: AiRequest) => Promise<AiResult> {
  const generate = api.ai.generateEmail.useMutation();
  const rewrite = api.ai.rewrite.useMutation();
  return useCallback(async (req) => {
    if (req.kind === "generate") return generate.mutateAsync({ prompt: req.prompt });
    return rewrite.mutateAsync({ text: req.text, instruction: req.instruction });
  }, [generate, rewrite]);
}
```

Passado ao `Editor` como `onAiRequest`. Se `onAiRequest` for `undefined`, toda a UI de IA some (o pacote não conhece tRPC).

### 6.2 Placeholder com IA

Quando o documento está vazio, além do texto do `Placeholder`, renderizar abaixo do canvas um botão discreto **"Escrever com IA"** (`SparklesIcon`). Ao clicar, abre um `Popover` com `Textarea` (mesma UX do popover atual em `editor-toolbar.tsx`), chama `onAiRequest({ kind: "generate", prompt })` e insere o resultado com `editor.chain().focus().insertContent(html).run()`.

Componente: `packages/email-editor/src/chrome/AiComposer.tsx`.

```ts
type AiComposerProps = {
  editor: TipTapEditor;
  onAiRequest: (req: AiRequest) => Promise<AiResult>;
  /** "empty" = estado inicial do documento; "block" = via menu de contexto. */
  variant: "empty" | "block";
  targetPos?: number;
};
```

### 6.3 "Editar com IA" por bloco

Item do `BlockContextMenu` (seção 7). Fluxo:

1. Extrair o texto do bloco: `editor.state.doc.nodeAt(pos)?.textContent`.
2. Abrir prompt de instrução (`Popover` com `Input`, sugestões rápidas: "Encurtar", "Deixar mais formal", "Corrigir gramática").
3. `onAiRequest({ kind: "rewrite", text, instruction })`.
4. Substituir o conteúdo do bloco:
   ```ts
   editor.chain().focus()
     .insertContentAt({ from: pos, to: pos + node.nodeSize }, { type: node.type.name, attrs: node.attrs, content: [{ type: "text", text: result.text }] })
     .run();
   ```
   **Atenção**: isso descarta marks (bold/link) do texto original. Comportamento aceito na v1; documentar no tooltip ("A formatação do trecho pode ser perdida").
5. Estado de carregamento: aplicar `Decoration` de classe `madmail-ai-pending` no range enquanto a promise não resolve.

### 6.4 Depreciação da toolbar atual

`apps/web/src/components/editor-toolbar.tsx` fica **obsoleto** ao fim da fase 4 (page style → painel direito; gerar com IA → `AiComposer`). Remover na fase 7, junto com sua importação em `campaigns/[campaignId]/edit/page.tsx`.

---

## 7. Menu de contexto por bloco

`packages/email-editor/src/menus/BlockContextMenu.tsx`.

**Gatilhos**: (a) clique no drag handle já criado por `extensions/dragHandle.ts` (elemento `.drag-handle` com `data-drag-handle`); (b) botão direito sobre o bloco; (c) atalho `Ctrl/Cmd + .` com bloco selecionado.

Para (a), a implementação mais limpa é usar a opção `dragHandleSelector` que o `DragHandlePlugin` já suporta (`options.dragHandleSelector`, `document.querySelector<HTMLElement>(...)`): renderizar o handle como componente React controlado, com `onClick` abrindo o `DropdownMenu` (`@usesend/ui/src/dropdown-menu`). Isso evita mexer na criação do elemento dentro do plugin.

Itens:

| Item | Ação | Atalho |
|---|---|---|
| Editar com IA | abre `AiComposer variant="block"` | — |
| Transformar em ▸ | submenu com blocos compatíveis do `BLOCK_REGISTRY` (mesma `category` do node atual; para texto: Texto/H1/H2/H3/Lista/Citação/Código) | — |
| Mover para cima | `editor.commands.moveNodeUp()` — **não existe no TipTap 2**; implementar helper `moveBlock(editor, pos, -1)` usando `tr.delete` + `tr.insert` | `Alt+↑` |
| Mover para baixo | `moveBlock(editor, pos, +1)` | `Alt+↓` |
| Duplicar | `editor.chain().insertContentAt(pos + node.nodeSize, node.toJSON()).run()` | `Ctrl/Cmd+D` |
| Excluir | `editor.chain().deleteRange({ from: pos, to: pos + node.nodeSize }).run()` | `Del` / `Backspace` |

Helper novo: `packages/email-editor/src/lib/block-ops.ts`

```ts
export function moveBlock(editor: TipTapEditor, pos: number, direction: -1 | 1): boolean;
export function duplicateBlock(editor: TipTapEditor, pos: number): boolean;
export function deleteBlock(editor: TipTapEditor, pos: number): boolean;
export function transformBlock(editor: TipTapEditor, pos: number, targetBlockId: string): boolean;
```

Atalhos registrados via nova extensão `extensions/BlockShortcuts.ts` com `addKeyboardShortcuts()`.

---

## 8. Plano de implementação em fases

Cada fase é entregável e testável isoladamente. Esforço relativo: **P** (pequeno), **M** (médio), **G** (grande).

| # | Fase | Entregável | Esforço | Depende de |
|---|---|---|---|---|
| 1 | **Registry de blocos** | `blocks/registry.ts` criado; `DEFAULT_SLASH_COMMANDS` derivado dele. Teste: menu `/` continua idêntico (mesmos itens, mesma ordem, mesmas seções). | M | — |
| 2 | **Shell de layout** | `chrome/EditorShell.tsx` + props novas do `Editor` (todas opcionais, default `false`). Teste: com todas as flags off, campanhas e templates renderizam **exatamente** como hoje. | M | 1 |
| 3 | **Trilho + paleta (clique)** | `LeftRail`, `BlockPalette`, `BlockPaletteFlyout` com inserção por clique. Modo `code` com fallback `editor.getHTML()`. Teste: inserir cada bloco pela paleta produz o mesmo JSON que o `/`. | M | 2 |
| 4 | **Drag and drop** | `DraggableBlockItem`, `BlockDropExtension`, `insertionPosFor`, indicador de destino, ghost de preview. Teste: arrastar cada bloco arrastável para antes/depois/entre blocos e dentro de `section` e `column`. | G | 3 |
| 5 | **Painel direito — Page style** | `PropertiesPanel`, `PageStylePanel`, `BodyStyleSection`, controles (`ColorField`, `NumberUnitField`, `BoxModelField`, `SegmentedControl`); novos campos em `PageStyle`; suporte no `renderer.markup()`. Teste: snapshot do HTML gerado sem `pageStyle` idêntico ao atual; com cada atributo, CSS inline correto. | G | 2 |
| 6 | **Painel direito — por bloco** | `useSelectedNode` + painéis de `button`, `image`, `section`, `columns`, `spacer`, `socialLinks`, embeds, `html`, texto. Teste: alterar cada atributo pelo painel reflete no canvas e no HTML. | G | 5 |
| 7 | **Cabeçalho do e-mail** | `EmailHeaderBar`, `EditorTopActions`, `PickTemplateDialog`, `UploadHtmlDropzone`; preview text no renderer; ligar em campanhas **e** templates (adicionar `onCreate` na página de templates). | G | 2 |
| 8 | **IA integrada** | `AiComposer`, `EditorAiBridge`, "Editar com IA" no menu de bloco, novo placeholder. | M | 7 |
| 9 | **Menu de contexto + atalhos** | `BlockContextMenu`, `lib/block-ops.ts`, `extensions/BlockShortcuts.ts`, handle controlado via `dragHandleSelector`. | M | 6 |
| 10 | **Limpeza** | Remover `editor-toolbar.tsx`; remover popovers de config duplicados dos NodeViews; ativar flags por default; ajustar `CodeView` para consumir `/api/to-html`. | M | 5–9 |

**Ordem recomendada**: 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9 → 10.
Racional: a fase 5 (painel de page style) entrega valor visível cedo e é independente do drag and drop, que é a peça de maior risco técnico. Adiantar 5 permite que 4 seja fatiada sem bloquear entregas.

---

## 9. Riscos e pontos de atenção

### 9.1 O renderer lança erro em node desconhecido

`renderNode()` faz `throw new Error(\`Node type "${type}" is not supported.\`)`. Consequência: qualquer node novo introduzido no editor **quebra o envio do e-mail em produção**, não apenas a prévia. Esta spec propositalmente **não introduz nodes novos**. Mitigações recomendadas independentemente:
- Adicionar um modo tolerante (`options.strict = false`) que loga e retorna `null` para nodes desconhecidos — reduz risco de e-mails não enviados.
- Cobrir `renderNode` com teste que percorre todos os `name` de extensão declarados em `extensions/index.ts` e falha se algum não tiver método correspondente em `EmailRenderer`.

### 9.2 Compatibilidade com clientes de e-mail

- `border-radius`, `box-shadow`, `padding` em `<body>`: ignorados no Outlook desktop (Word rendering engine). Aceitar degradação, mas **nunca** depender deles para legibilidade.
- `max-width` no Outlook não funciona → emitir também `width` fixo no `<Container>`.
- Herança de `color` é inconsistente → `textColor` deve ser propagado para cada `<Text>`/`<Heading>` (sobrescrevendo `DEFAULT_THEME`), não apenas no `<Body>`.
- Unidades relativas (`rem`, `em`): evitar em atributos novos; a UI deve oferecer só `px` e `%`.

### 9.3 Migração de documentos salvos

- `pageStyle` novo é **puramente aditivo** e todos os campos são opcionais com default igual ao comportamento atual. Documentos antigos (sem `pageStyle` ou com os 4 campos atuais) continuam renderizando byte a byte o mesmo HTML — isso precisa ser garantido por **teste de snapshot** antes da fase 5 ir para produção.
- Ponto crítico: o `padding: "0.5rem"` hardcoded do `<Container>`. Se `contentPadding` for introduzido com default `"0"`, todos os e-mails existentes mudam. Default obrigatório: `"0.5rem"`.
- `PageStyleDocument` usa `tr.setDocAttribute`, disponível a partir do ProseMirror recente — já em uso, sem risco novo.

### 9.4 Import por caminho profundo do renderer

`apps/web` importa `@usesend/email-editor/src/renderer` em **8 arquivos** (mais 2 mocks de teste):

- `apps/web/src/app/api/to-html/route.ts`
- `apps/web/src/server/api/routers/campaign.ts`
- `apps/web/src/server/api/routers/template.ts`
- `apps/web/src/server/public-api/api/templates/create-template.ts`
- `apps/web/src/server/public-api/api/templates/render-template.ts`
- `apps/web/src/server/service/campaign-service.ts`
- `apps/web/src/server/service/double-opt-in-service.ts`
- `apps/web/src/server/service/email-service.ts`
- mocks: `campaign-service.unit.test.ts`, `double-opt-in-service.unit.test.ts`; uso direto em `apps/web/src/lib/constants/campaign.unit.test.ts`

Riscos daí:
- `renderer.tsx` é importado em **contexto de servidor**. Ele **não pode** passar a importar nada de `chrome/`, `panels/` ou qualquer coisa que puxe `react-dom`, `tippy.js` ou CSS. O tipo `PageStyle` e `boxToCss` devem viver em módulos sem side effects (`extensions/PageStyleExtension.ts` já é seguro? — ele importa `@tiptap/core`, que é isomórfico, mas para evitar dúvida **mover `PageStyle` e `BoxValue` para `packages/email-editor/src/types.ts`**, que já existe e é puro).
- Qualquer mudança na assinatura do construtor de `EmailRenderer` afeta os 8 call sites — manter estritamente aditiva/opcional.
- Como o import é por caminho de origem (`/src/renderer`, com `main` do package apontando para `./src/index.ts`), não há build intermediário: erros de tipo aparecem direto no build do `apps/web`.

### 9.5 Drag and drop

- Conflito com `extensions/dragHandle.ts` (arrasto interno). Mitigação: MIME customizado `application/x-madmail-block` + retorno `true` no handler. **A confirmar** por teste manual a ordem de execução dos `handleDOMEvents`.
- O `dropcursor` do StarterKit **não** cobre drag externo → indicador próprio via `Decoration.widget`. Não confiar no dropcursor.
- Drop dentro de containers aninhados (`column` dentro de `columns` dentro de `section`) pode calcular posição inválida. Validar com `view.state.doc.resolve(pos)` e checar se o schema permite o tipo naquele contexto antes de inserir; se não permitir, subir de nível até encontrar posição válida.
- `setDragImage` exige que o elemento esteja no DOM no momento do `dragstart` (fora da viewport, não `display:none`).
- Touch: HTML5 drag não funciona em mobile/tablet. O clique continua funcionando — comportamento aceito.
- `console.log(slice, view)` na linha 169 de `extensions/dragHandle.ts` é ruído existente; remover ao tocar no arquivo.

### 9.6 Performance e re-render

- `useSelectedNode` assina `transaction`, que dispara a cada tecla digitada. Obrigatório memoizar e comparar por `(typeName, pos)` antes de setar estado, senão o painel direito re-renderiza a cada caractere.
- O `CommandList` do slash já registra `document.addEventListener("keydown")`; o `BlockShortcuts` precisa checar a presença de `#slash-command` no DOM antes de agir (mesmo padrão já usado em `editor.tsx`, `handleDOMEvents.keydown`).

### 9.7 Outros

- O layout de 3 colunas conflita com o container atual em `campaigns/.../edit/page.tsx` (`w-[700px] mx-auto` com filho `w-[600px] mx-auto`) e `templates/.../edit/page.tsx` (`sm:w-[700px]`). O shell precisa quebrar esse encaixe — as páginas devem passar a usar largura total quando `showBlockPalette`/`showPropertiesPanel` estiverem ligados.
- O botão **Publish** do alvo não tem equivalente direto hoje (campanhas salvam com debounce e têm fluxo próprio de envio). **A confirmar** com o cliente o que "Publish" faz no Madmail: salvar+validar, agendar, ou enviar.
- i18n: o código já mistura pt-BR (slash commands, toolbar) e en (placeholder do TipTap, `content` de exemplo em `editor.tsx`). Padronizar em pt-BR nos textos novos; não há infra de i18n no pacote (**a confirmar** se será introduzida).

---

## 10. Checklist de aceite

**Paleta e trilho**
- [ ] Trilho esquerdo visível com 3 modos; modo "edição" ativo por padrão e destacado.
- [ ] Modo `</>` mostra o HTML do e-mail (read-only) e volta ao editor sem perder conteúdo.
- [ ] Paleta com 4 categorias; flyout abre à direita e fecha ao clicar fora ou `Esc`.
- [ ] O flyout de texto lista, nesta ordem: Texto, Título, Subtítulo, Cabeçalho, Lista com marcadores, Lista numerada.
- [ ] Clicar num bloco insere na posição do cursor (ou no fim se não houver cursor).
- [ ] Nenhum bloco fica inacessível por corte de altura (sem `max-h-[330px]`).

**Drag and drop**
- [ ] Todo bloco sem `requiresInteraction` é arrastável da paleta para o documento.
- [ ] Durante o arrasto aparece um preview com ícone + nome do bloco.
- [ ] Uma linha indicadora mostra exatamente onde o bloco será inserido, atualizando com o movimento do mouse.
- [ ] Soltar acima da metade de um bloco insere antes; abaixo, depois.
- [ ] Soltar dentro de `section` e de `column` funciona e respeita o schema.
- [ ] Soltar fora do canvas cancela sem alterar o documento.
- [ ] Arrastar blocos já existentes (drag handle) continua funcionando sem regressão.

**Painel direito**
- [ ] Sem seleção de bloco → painel mostra "Page style" + seção "Body".
- [ ] Com bloco selecionado → painel mostra as propriedades daquele bloco, com o nome do bloco no cabeçalho.
- [ ] Todos os campos listados em B.4 existem, leem o valor atual e gravam via `setPageStyle`/`updateAttributes`.
- [ ] Alteração no painel reflete no canvas imediatamente e persiste após salvar/recarregar.
- [ ] Painel é colapsável e o estado persiste entre sessões.
- [ ] Botão Publish, avatar e menu "..." aparecem no topo do painel.
- [ ] "Edit theme" e "Global CSS" presentes no rodapé (desabilitados na v1, com tooltip "Em breve").

**Cabeçalho**
- [ ] Breadcrumb + badge de status no topo.
- [ ] Linha From com valor editável e link Reply-To funcional.
- [ ] Linha Subject com valor editável e link Preview text funcional.
- [ ] Preview text aparece como `<Preview>` no HTML gerado.
- [ ] Placeholder pt-BR mencionando `/` e IA.
- [ ] "Pick a template" e "Upload HTML / Ctrl+V" funcionam com documento vazio.
- [ ] O cabeçalho aparece **tanto** em campanhas quanto em templates.

**IA**
- [ ] "Escrever com IA" no estado vazio gera e insere conteúdo via `api.ai.generateEmail`.
- [ ] "Editar com IA" no menu de bloco reescreve o bloco via `api.ai.rewrite`.
- [ ] Com `ANTHROPIC_API_KEY` ausente, a UI mostra a mensagem de erro do router sem quebrar o editor.

**Menu de contexto**
- [ ] Menu abre pelo drag handle, botão direito e `Ctrl/Cmd+.`.
- [ ] Editar com IA, Transformar em, Mover ↑/↓, Duplicar, Excluir funcionam.
- [ ] Atalhos `Alt+↑`, `Alt+↓`, `Ctrl/Cmd+D` funcionam e não conflitam com o menu `/`.

**Não-regressão (bloqueante)**
- [ ] Teste de snapshot: documento salvo antes das mudanças gera HTML **idêntico** depois.
- [ ] Nenhum `Node type "X" is not supported` em nenhum documento existente.
- [ ] Os 8 call sites de `EmailRenderer` em `apps/web` compilam sem alteração.
- [ ] `pnpm lint` e a suíte de testes unitários de `apps/web` passam.
- [ ] E-mail de teste renderiza corretamente em Gmail (web + app), Outlook desktop, Apple Mail.
