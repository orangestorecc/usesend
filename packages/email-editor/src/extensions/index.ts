import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import CodeBlock from "@tiptap/extension-code-block";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Placeholder from "@tiptap/extension-placeholder";
import GlobalDragHandle from "./dragHandle";
import { ButtonExtension } from "./ButtonExtension";
import { SlashCommand, getSlashCommandSuggestions } from "./SlashCommand";
import { VariableExtension } from "./VariableExtension";
import { getVariableSuggestions } from "../nodes/variable";
import { UnsubscribeFooterExtension } from "./UnsubsubscribeExtension";
import { ResizableImageExtension, UploadFn } from "./ImageExtension";
import { SpacerExtension } from "./SpacerExtension";
import { HtmlExtension } from "./HtmlExtension";
import { SectionExtension } from "./SectionExtension";
import { ColumnsExtension, ColumnExtension } from "./ColumnsExtension";
import { SocialLinksExtension } from "./SocialLinksExtension";
import {
  YoutubeExtension,
  TwitterExtension,
  ChartExtension,
} from "./EmbedExtensions";
import { PageStyleDocument } from "./PageStyleExtension";
import { BlockDropExtension } from "./BlockDropExtension";
import { BlockShortcuts } from "./BlockShortcuts";

export function extensions({
  variables,
  uploadImage,
  variableSuggestionsHelperText,
  placeholder,
}: {
  variables?: Array<string>;
  uploadImage?: UploadFn;
  variableSuggestionsHelperText?: string;
  placeholder?: string;
}) {
  const extensions = [
    PageStyleDocument,
    StarterKit.configure({
      document: false,
      heading: {
        levels: [1, 2, 3],
      },
      dropcursor: {
        color: "#555",
        width: 3,
      },
      code: {
        HTMLAttributes: {
          class:
            "p-0.5 px-2 bg-slate-200 text-black text-sm rounded tracking-normal font-normal",
        },
      },
      blockquote: {
        HTMLAttributes: {
          class: "not-prose border-l-4 border-gray-300 pl-4 mt-4 mb-4",
        },
      },
    }),
    Underline,
    Link.configure({
      HTMLAttributes: {
        class: "underline cursor-pointer",
      },
      openOnClick: false,
    }),
    TextAlign.configure({
      types: [Paragraph.name, Heading.name],
    }),
    CodeBlock.configure({
      HTMLAttributes: {
        class:
          "p-4 bg-slate-800 text-gray-100 text-sm rounded-md tracking-normal font-normal",
      },
    }),
    Heading.configure({
      levels: [1, 2, 3],
    }),
    TextStyle,
    Color,
    TaskItem,
    TaskList,
    SlashCommand.configure({
      suggestion: getSlashCommandSuggestions([], uploadImage),
      uploadImage,
    }),
    Placeholder.configure({
      placeholder: placeholder ?? "Digite '/' para ver os blocos disponíveis",
    }),
    ButtonExtension,
    GlobalDragHandle,
    VariableExtension.configure({
      suggestion: getVariableSuggestions(
        variables,
        variableSuggestionsHelperText,
      ),
    }),
    UnsubscribeFooterExtension,
    ResizableImageExtension.configure({ uploadImage }),
    SpacerExtension,
    HtmlExtension,
    SectionExtension,
    ColumnsExtension,
    ColumnExtension,
    SocialLinksExtension,
    YoutubeExtension,
    TwitterExtension,
    ChartExtension,
    // Depois de GlobalDragHandle: o drop externo precisa interromper a cadeia
    // de handleDOMEvents sem passar pelo handler do arrasto interno.
    BlockDropExtension,
    BlockShortcuts,
  ];

  return extensions;
}
