import { useEffect, useState } from "react";
import type { Editor as TipTapEditor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

/** Nós com painel próprio, do mais interno para o mais externo. */
const PANELED = new Set([
  "button",
  "spacer",
  "image",
  "html",
  "socialLinks",
  "youtube",
  "twitter",
  "chart",
  "column",
  "columns",
  "section",
]);

export type SelectedNode = {
  typeName: string;
  /** Posição ANTES do nó — usada para setNodeMarkup sem ambiguidade. */
  pos: number;
  attrs: Record<string, unknown>;
};

/**
 * Nó cujo painel deve aparecer à direita.
 *
 * Para nós atômicos (`button`, `image`, ...) a seleção já é uma NodeSelection.
 * Para o cursor dentro de texto, sobe pela árvore até achar um container com
 * painel (`section`, `column`); não achando, devolve null e o painel cai no
 * estilo da página.
 */
export function useSelectedNode(
  editor: TipTapEditor | null,
): SelectedNode | null {
  const [selected, setSelected] = useState<SelectedNode | null>(null);

  useEffect(() => {
    if (!editor) return;

    const read = () => {
      const { selection } = editor.state;

      if (selection instanceof NodeSelection) {
        const { node } = selection;
        if (PANELED.has(node.type.name)) {
          setSelected({
            typeName: node.type.name,
            pos: selection.from,
            attrs: { ...node.attrs },
          });
          return;
        }
      }

      const $from = editor.state.selection.$from;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (PANELED.has(node.type.name)) {
          setSelected({
            typeName: node.type.name,
            pos: $from.before(d),
            attrs: { ...node.attrs },
          });
          return;
        }
      }

      setSelected(null);
    };

    read();
    editor.on("selectionUpdate", read);
    editor.on("transaction", read);
    return () => {
      editor.off("selectionUpdate", read);
      editor.off("transaction", read);
    };
  }, [editor]);

  return selected;
}

/**
 * Escrita de atributos por POSIÇÃO, e não por tipo.
 *
 * `updateAttributes(tipo, attrs)` do TipTap age sobre o nó daquele tipo mais
 * próximo da seleção — ambíguo quando há aninhamento (`column` dentro de
 * `columns` dentro de `section`). Com a posição não há dúvida de qual nó muda.
 */
export function updateNodeAttrs(
  editor: TipTapEditor,
  selected: SelectedNode,
  patch: Record<string, unknown>,
) {
  const node = editor.state.doc.nodeAt(selected.pos);
  if (!node) return;
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(selected.pos, undefined, {
      ...node.attrs,
      ...patch,
    }),
  );
}
