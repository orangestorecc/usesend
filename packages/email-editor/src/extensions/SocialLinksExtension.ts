import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { SocialLinksComponent } from "../nodes/social-links";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    socialLinks: {
      setSocialLinks: () => ReturnType;
    };
  }
}

export type SocialLink = { platform: string; url: string };

/** Bloco de ícones de redes sociais (atom). */
export const SocialLinksExtension = Node.create({
  name: "socialLinks",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      links: {
        default: [
          { platform: "instagram", url: "" },
          { platform: "facebook", url: "" },
          { platform: "x", url: "" },
        ] as SocialLink[],
      },
      align: { default: "center" },
      size: { default: 32 },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-unsend-component="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-unsend-component": this.name }, HTMLAttributes),
    ];
  },

  addCommands() {
    return {
      setSocialLinks:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: {} }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(SocialLinksComponent);
  },
});
