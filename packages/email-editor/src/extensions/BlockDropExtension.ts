import { Extension, type JSONContent } from "@tiptap/core";
import type { NodeType } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import { BLOCK_MIME, getBlock } from "../blocks/registry";

/**
 * Drop de blocos vindos da paleta lateral (arrasto EXTERNO à view).
 *
 * O `dropcursor` do StarterKit só reage a `view.dragging`, que o ProseMirror
 * preenche apenas no arrasto interno (feito pelo dragHandle.ts). Para o arrasto
 * que nasce fora da view não há nada pronto: tratamos `dragover`/`drop` na mão
 * e desenhamos o indicador de destino como uma decoração própria.
 */

export const blockDropKey = new PluginKey<number | null>("blockDrop");

/** Nós em que se desce para procurar a posição exata do drop. */
const CONTAINERS = new Set(["section", "columns", "column"]);

/**
 * Posição de inserção a partir das coordenadas do ponteiro.
 *
 * Não usa `view.posAtCoords`: sobre a moldura de um NodeView (a área vazia de
 * uma `column`, por exemplo) ela devolve o nó de fora, e o bloco acabava ao lado
 * do container em vez de dentro dele. Em vez disso descemos pela árvore
 * comparando o ponteiro com as caixas do DOM de cada filho.
 */
export function insertionPosFor(
  view: EditorView,
  clientX: number,
  clientY: number,
): number {
  const { doc } = view.state;
  let node = doc;
  let contentStart = 0;

  // O laço tem teto: um documento com aninhamento patológico não trava a UI.
  for (let nivel = 0; nivel < 10; nivel++) {
    const filhos: Array<{ pos: number; size: number; tipo: string; rect: DOMRect | null }> = [];
    node.forEach((child, offset) => {
      const pos = contentStart + offset;
      const dom = view.nodeDOM(pos);
      filhos.push({
        pos,
        size: child.nodeSize,
        tipo: child.type.name,
        rect: dom instanceof HTMLElement ? dom.getBoundingClientRect() : null,
      });
    });

    // Container vazio: a posição de conteúdo é o próprio destino.
    if (!filhos.length) return contentStart;

    const sob = filhos.find(
      (f) =>
        f.rect &&
        clientY >= f.rect.top &&
        clientY <= f.rect.bottom &&
        clientX >= f.rect.left &&
        clientX <= f.rect.right,
    );

    if (sob && CONTAINERS.has(sob.tipo)) {
      node = doc.nodeAt(sob.pos)!;
      contentStart = sob.pos + 1;
      continue;
    }

    if (sob && sob.rect) {
      return clientY < sob.rect.top + sob.rect.height / 2
        ? sob.pos
        : sob.pos + sob.size;
    }

    // Ponteiro num vão entre filhos (ou fora deles): usa o primeiro que começa
    // abaixo do cursor; se não houver, vai para o fim deste container.
    const abaixo = filhos.find((f) => f.rect && f.rect.top > clientY);
    if (abaixo) return abaixo.pos;
    const ultimo = filhos[filhos.length - 1]!;
    return ultimo.pos + ultimo.size;
  }

  return contentStart;
}

/**
 * Sobe de nível até achar uma posição onde o schema aceite o nó. Sem isso, um
 * drop sobre `column` dentro de `columns` dentro de `section` pode produzir uma
 * inserção inválida — que o TipTap descarta em silêncio.
 */
function schemaValidPos(
  view: EditorView,
  pos: number,
  type: NodeType | undefined,
): number {
  if (!type) return pos;
  const $pos = view.state.doc.resolve(pos);
  for (let d = $pos.depth; d >= 0; d--) {
    const index = $pos.index(d);
    if ($pos.node(d).canReplaceWith(index, index, type)) {
      return d === $pos.depth ? pos : $pos.after(d + 1);
    }
  }
  return view.state.doc.content.size;
}

function isBlockDrag(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer?.types.includes(BLOCK_MIME));
}

function buildIndicator(): HTMLElement {
  const line = document.createElement("div");
  line.className = "madmail-drop-indicator";
  return line;
}

export const BlockDropExtension = Extension.create({
  name: "blockDrop",

  addProseMirrorPlugins() {
    const { editor } = this;

    /** Guarda a posição destacada e liga/desliga a classe de arrasto na view. */
    const setTarget = (view: EditorView, pos: number | null) => {
      if (blockDropKey.getState(view.state) === pos) return;
      view.dispatch(view.state.tr.setMeta(blockDropKey, { pos }));
      view.dom.classList.toggle("madmail-dragging-external", pos !== null);
    };

    return [
      new Plugin<number | null>({
        key: blockDropKey,

        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(blockDropKey) as
              | { pos: number | null }
              | undefined;
            if (meta) return meta.pos;
            // Mantém o destaque coerente quando o documento muda no meio do
            // arrasto (raro, mas o mapeamento é barato).
            return value === null ? null : tr.mapping.map(value);
          },
        },

        props: {
          decorations(state) {
            const pos = blockDropKey.getState(state);
            if (pos === null || pos === undefined) return null;
            return DecorationSet.create(state.doc, [
              Decoration.widget(pos, buildIndicator, {
                side: -1,
                key: "madmail-drop-indicator",
              }),
            ]);
          },
        },

        /**
         * Os listeners ficam em `view.dom` na fase de CAPTURA, e não em
         * `props.handleDOMEvents`. Motivo: o ProseMirror descarta eventos cujo
         * alvo esteja na moldura de um NodeView cujo `stopEvent` retorne true —
         * é o caso da área vazia de uma `column`, onde o drop simplesmente não
         * chegava. A captura também garante que rodamos antes do dragHandle.ts.
         */
        view(view) {
          const posFromEvent = (event: DragEvent) =>
            insertionPosFor(view, event.clientX, event.clientY);

          const onDragOver = (event: DragEvent) => {
            if (!isBlockDrag(event.dataTransfer)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer!.dropEffect = "copy";
            setTarget(view, posFromEvent(event));
          };

          const onDragLeave = (event: DragEvent) => {
            if (!isBlockDrag(event.dataTransfer)) return;
            // dragleave dispara ao cruzar as bordas dos filhos; só interessa a
            // saída da view inteira.
            const to = event.relatedTarget as Node | null;
            if (to && view.dom.contains(to)) return;
            setTarget(view, null);
          };

          const onDrop = (event: DragEvent) => {
            const id = event.dataTransfer?.getData(BLOCK_MIME);
            if (!id) return;
            event.preventDefault();
            event.stopPropagation();
            setTarget(view, null);

            const block = getBlock(id);
            if (!block) return;

            const json = block.toJSON?.() as JSONContent | undefined;
            const pos = schemaValidPos(
              view,
              posFromEvent(event),
              json ? view.state.schema.nodes[json.type!] : undefined,
            );

            if (json) {
              editor.chain().focus().insertContentAt(pos, json).run();
            } else {
              block.insert(editor, { at: pos });
            }
          };

          view.dom.addEventListener("dragover", onDragOver, true);
          view.dom.addEventListener("dragleave", onDragLeave, true);
          view.dom.addEventListener("drop", onDrop, true);

          return {
            destroy() {
              view.dom.removeEventListener("dragover", onDragOver, true);
              view.dom.removeEventListener("dragleave", onDragLeave, true);
              view.dom.removeEventListener("drop", onDrop, true);
            },
          };
        },
      }),
    ];
  },
});

export default BlockDropExtension;
