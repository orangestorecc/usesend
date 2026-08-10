import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { SpacerComponent } from "../nodes/spacer";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spacer: {
      setSpacer: () => ReturnType;
    };
  }
}

export const SpacerExtension = Node.create({
  name: "spacer",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      height: {
        default: "24px",
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
      setSpacer:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: {} });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(SpacerComponent);
  },
});
