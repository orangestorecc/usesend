import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { HtmlComponent } from "../nodes/html";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    htmlBlock: {
      setHtmlBlock: () => ReturnType;
    };
  }
}

export const HtmlExtension = Node.create({
  name: "html",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      html: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-unsend-component="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-unsend-component": this.name },
        HTMLAttributes,
      ),
    ];
  },

  addCommands() {
    return {
      setHtmlBlock:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: { html: "" } });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(HtmlComponent);
  },
});
