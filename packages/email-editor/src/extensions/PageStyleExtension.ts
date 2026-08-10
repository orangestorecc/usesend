import { Node } from "@tiptap/core";
import type { PageStyle } from "../types";

export type { PageStyle };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageStyle: {
      /** Define o estilo global da página (fundo, largura, fonte). */
      setPageStyle: (style: PageStyle) => ReturnType;
    };
  }
}

/**
 * Substitui o Document padrão (nó raiz) para carregar um atributo `pageStyle`.
 * O renderer server-side lê `doc.attrs.pageStyle` e aplica no <Body>/<Container>.
 * Definido via Node.create (topNode) para não depender de @tiptap/extension-document.
 */
export const PageStyleDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "block+",

  addAttributes() {
    return {
      pageStyle: {
        default: {} as PageStyle,
        parseHTML: (el: HTMLElement) => {
          const raw = el.getAttribute("data-page-style");
          if (!raw) return {};
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        },
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.pageStyle || Object.keys(attrs.pageStyle).length === 0)
            return {};
          return { "data-page-style": JSON.stringify(attrs.pageStyle) };
        },
      },
    };
  },

  addCommands() {
    return {
      setPageStyle:
        (style: PageStyle) =>
        ({ tr, dispatch }: { tr: any; dispatch?: any }) => {
          if (dispatch) {
            const current = (tr.doc.attrs.pageStyle ?? {}) as PageStyle;
            tr.setDocAttribute("pageStyle", { ...current, ...style });
          }
          return true;
        },
    };
  },
});
