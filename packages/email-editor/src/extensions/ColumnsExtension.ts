import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { ColumnsComponent, ColumnComponent } from "../nodes/columns";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      /** Insere um bloco de colunas com N colunas (2, 3 ou 4). */
      setColumns: (count?: number) => ReturnType;
    };
  }
}

/** Coluna individual — carrega blocos. */
export const ColumnExtension = Node.create({
  name: "column",
  content: "block+",
  isolating: true,

  addAttributes() {
    return {
      width: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-unsend-component="column"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-unsend-component": "column" }, HTMLAttributes),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnComponent);
  },
});

/** Container de colunas. */
export const ColumnsExtension = Node.create({
  name: "columns",
  group: "block",
  content: "column+",
  draggable: true,
  defining: true,

  addAttributes() {
    return {
      gap: { default: "16px" },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-unsend-component="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-unsend-component": this.name }, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setColumns:
        (count = 2) =>
        ({ commands }) => {
          const n = Math.min(4, Math.max(2, count));
          const columns = Array.from({ length: n }, () => ({
            type: "column",
            content: [{ type: "paragraph" }],
          }));
          return commands.insertContent({ type: this.name, content: columns });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnsComponent);
  },
});
