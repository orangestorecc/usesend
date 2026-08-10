import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { SectionComponent } from "../nodes/section";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    section: {
      setSection: () => ReturnType;
    };
  }
}

/**
 * Bloco "Seção": um container com fundo/preenchimento/borda que agrupa outros
 * blocos. Renderiza os filhos dentro de um Container estilizado.
 */
export const SectionExtension = Node.create({
  name: "section",
  group: "block",
  content: "block+",
  draggable: true,
  defining: true,

  addAttributes() {
    return {
      backgroundColor: { default: "#f4f4f5" },
      padding: { default: "24px" },
      borderRadius: { default: "8px" },
      align: { default: "left" },
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
      setSection:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [{ type: "paragraph" }],
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionComponent);
  },
});
