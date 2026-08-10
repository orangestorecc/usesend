import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import {
  YoutubeComponent,
  TwitterComponent,
  ChartComponent,
} from "../nodes/embeds";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embeds: {
      setYoutube: () => ReturnType;
      setTwitter: () => ReturnType;
      setChart: () => ReturnType;
    };
  }
}

export { youtubeId } from "../lib/embed-helpers";

export const YoutubeExtension = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { url: { default: "" }, align: { default: "center" } };
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
      setYoutube:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: {} }),
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeComponent);
  },
});

export const TwitterExtension = Node.create({
  name: "twitter",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: "" },
      username: { default: "" },
      text: { default: "" },
      align: { default: "center" },
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
      setTwitter:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: {} }),
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(TwitterComponent);
  },
});

export const ChartExtension = Node.create({
  name: "chart",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      chartType: { default: "bar" },
      title: { default: "" },
      labels: { default: "Jan, Fev, Mar, Abr" },
      values: { default: "12, 19, 8, 15" },
      color: { default: "#2563eb" },
      align: { default: "center" },
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
      setChart:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: {} }),
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChartComponent);
  },
});
