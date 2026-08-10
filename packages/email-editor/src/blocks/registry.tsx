import type { Editor as TipTapEditor, JSONContent, Range } from "@tiptap/core";
import type { ReactNode } from "react";
import {
  BarChart3Icon,
  Code2Icon,
  CodeIcon,
  Columns2Icon,
  Columns3Icon,
  Columns4Icon,
  DivideIcon,
  EraserIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  LayoutPanelTopIcon,
  ListIcon,
  ListOrderedIcon,
  MoveVerticalIcon,
  RectangleEllipsisIcon,
  Share2Icon,
  SquareSplitVerticalIcon,
  TextIcon,
  TextQuoteIcon,
  TwitterIcon,
  UserXIcon,
  VariableIcon,
  YoutubeIcon,
} from "lucide-react";

import type { UploadFn } from "../extensions/ImageExtension";

/**
 * Fonte única de verdade dos blocos do editor.
 *
 * Alimenta o menu "/" (SlashCommand), a paleta lateral e o "Transformar em".
 * Antes, a lista vivia apenas em SlashCommand.tsx — o que tornava impossível
 * mostrar os blocos em qualquer outro lugar.
 */

export type BlockCategory = "text" | "media" | "layout" | "utility";

/** Rótulo exibido como cabeçalho de seção no menu "/". */
export const CATEGORY_LABEL: Record<BlockCategory, string> = {
  text: "Texto",
  media: "Mídia",
  layout: "Layout",
  utility: "Utilitário",
};

export type BlockInsertOptions = {
  /**
   * Trecho do "/" a remover antes de inserir. Passado pelo SlashCommand para
   * que remoção e inserção aconteçam na MESMA transação — dividir em duas
   * mudaria o histórico de desfazer.
   */
  range?: Range;
  /** Posição de inserção (usada pelo drag and drop). */
  at?: number;
  /** Necessário para o bloco de imagem. */
  uploadImage?: UploadFn;
};

export type BlockDefinition = {
  /** Identificador estável — usado no dataTransfer do arrasto. */
  id: string;
  title: string;
  description: string;
  category: BlockCategory;
  searchTerms: string[];
  icon: ReactNode;
  /** Atalho markdown exibido à direita no menu. */
  shortcut?: string;
  insert: (editor: TipTapEditor, opts?: BlockInsertOptions) => void;
  /** Conteúdo inserido no drop. Ausente => o bloco não suporta arrastar. */
  toJSON?: () => JSONContent;
  /** Abre file picker/prompt — incompatível com drop direto. */
  requiresInteraction?: boolean;
};

/** Inicia a cadeia já tratando o range do "/" e a posição do drop. */
function chain(editor: TipTapEditor, opts?: BlockInsertOptions) {
  const c = editor.chain().focus();
  if (opts?.range) return c.deleteRange(opts.range);
  if (typeof opts?.at === "number") return c.setTextSelection(opts.at);
  return c;
}

/** Fluxo de upload da imagem, preservado do comportamento original. */
async function pickAndUploadImage(
  editor: TipTapEditor,
  uploadImage: UploadFn,
  opts?: BlockInsertOptions,
) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    chain(editor, opts).run();
    const placeholder = URL.createObjectURL(file);
    editor
      .chain()
      .focus()
      .setImage({ src: placeholder })
      .updateAttributes("image", { isUploading: true })
      .run();
    try {
      const url = await uploadImage(file);
      editor
        .chain()
        .focus()
        .updateAttributes("image", { src: url, isUploading: false })
        .run();
    } catch (e) {
      editor.chain().focus().deleteNode("image").run();
      console.error("Falha ao enviar a imagem:", e);
    }
  };
  input.click();
}

export const BLOCK_REGISTRY: BlockDefinition[] = [
  // ---------------------------------------------------------------- Texto
  {
    id: "paragraph",
    title: "Texto",
    description: "Comece a digitar com texto simples.",
    category: "text",
    searchTerms: ["p", "paragraph", "texto"],
    icon: <TextIcon className="h-4 w-4" />,
    insert: (editor, opts) =>
      chain(editor, opts).toggleNode("paragraph", "paragraph").run(),
    toJSON: () => ({ type: "paragraph" }),
  },
  {
    id: "heading1",
    title: "Título 1",
    description: "Título de seção grande.",
    category: "text",
    searchTerms: ["title", "big", "large", "titulo", "h1"],
    shortcut: "#",
    icon: <Heading1Icon className="h-4 w-4" />,
    insert: (editor, opts) =>
      chain(editor, opts).setNode("heading", { level: 1 }).run(),
    toJSON: () => ({ type: "heading", attrs: { level: 1 } }),
  },
  {
    id: "heading2",
    title: "Título 2",
    description: "Título de seção médio.",
    category: "text",
    searchTerms: ["subtitle", "medium", "subtitulo", "h2"],
    shortcut: "##",
    icon: <Heading2Icon className="h-4 w-4" />,
    insert: (editor, opts) =>
      chain(editor, opts).setNode("heading", { level: 2 }).run(),
    toJSON: () => ({ type: "heading", attrs: { level: 2 } }),
  },
  {
    id: "heading3",
    title: "Título 3",
    description: "Título de seção pequeno.",
    category: "text",
    searchTerms: ["subtitle", "small", "h3"],
    shortcut: "###",
    icon: <Heading3Icon className="h-4 w-4" />,
    insert: (editor, opts) =>
      chain(editor, opts).setNode("heading", { level: 3 }).run(),
    toJSON: () => ({ type: "heading", attrs: { level: 3 } }),
  },
  {
    id: "bulletList",
    title: "Lista com marcadores",
    description: "Crie uma lista com marcadores simples.",
    category: "text",
    searchTerms: ["unordered", "point", "lista", "bullet"],
    shortcut: "-",
    icon: <ListIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).toggleBulletList().run(),
    toJSON: () => ({
      type: "bulletList",
      content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
    }),
  },
  {
    id: "orderedList",
    title: "Lista numerada",
    description: "Crie uma lista com numeração.",
    category: "text",
    searchTerms: ["ordered", "numerada"],
    shortcut: "1.",
    icon: <ListOrderedIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).toggleOrderedList().run(),
    toJSON: () => ({
      type: "orderedList",
      content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
    }),
  },
  {
    id: "blockquote",
    title: "Citação",
    description: "Adicione uma citação.",
    category: "text",
    searchTerms: ["quote", "blockquote", "citacao"],
    shortcut: ">",
    icon: <TextQuoteIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).toggleBlockquote().run(),
    toJSON: () => ({
      type: "blockquote",
      content: [{ type: "paragraph" }],
    }),
  },
  {
    id: "codeBlock",
    title: "Bloco de código",
    description: "Adicione código.",
    category: "text",
    searchTerms: ["code", "codigo"],
    icon: <CodeIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).toggleCodeBlock().run(),
    toJSON: () => ({ type: "codeBlock" }),
  },

  // ---------------------------------------------------------------- Mídia
  {
    id: "image",
    title: "Imagem",
    description: "Imagem em largura total",
    category: "media",
    searchTerms: ["image", "imagem"],
    icon: <ImageIcon className="h-4 w-4" />,
    requiresInteraction: true,
    insert: (editor, opts) => {
      if (opts?.uploadImage) {
        void pickAndUploadImage(editor, opts.uploadImage, opts);
        return;
      }
      const imageUrl = prompt("URL da imagem: ") || "";
      if (!imageUrl) return;
      chain(editor, opts).run();
      editor.chain().focus().setImage({ src: imageUrl }).run();
    },
  },

  // --------------------------------------------------------------- Layout
  {
    id: "button",
    title: "Botão",
    description: "Adicione um botão.",
    category: "layout",
    searchTerms: ["button", "botao"],
    icon: <RectangleEllipsisIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setButton().run(),
    toJSON: () => ({ type: "button" }),
  },
  {
    id: "section",
    title: "Seção",
    description: "Agrupe blocos com fundo e preenchimento.",
    category: "layout",
    searchTerms: ["section", "secao", "container", "bloco"],
    icon: <LayoutPanelTopIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setSection().run(),
    toJSON: () => ({
      type: "section",
      content: [{ type: "paragraph" }],
    }),
  },
  {
    id: "columns2",
    title: "2 Colunas",
    description: "Layout com duas colunas.",
    category: "layout",
    searchTerms: ["columns", "colunas", "2", "duas"],
    icon: <Columns2Icon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setColumns(2).run(),
    toJSON: () => columnsJSON(2),
  },
  {
    id: "columns3",
    title: "3 Colunas",
    description: "Layout com três colunas.",
    category: "layout",
    searchTerms: ["columns", "colunas", "3", "tres"],
    icon: <Columns3Icon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setColumns(3).run(),
    toJSON: () => columnsJSON(3),
  },
  {
    id: "columns4",
    title: "4 Colunas",
    description: "Layout com quatro colunas.",
    category: "layout",
    searchTerms: ["columns", "colunas", "4", "quatro"],
    icon: <Columns4Icon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setColumns(4).run(),
    toJSON: () => columnsJSON(4),
  },

  // ------------------------------------------------------ Mídia (embeds)
  {
    id: "socialLinks",
    title: "Redes sociais",
    description: "Ícones com links para redes sociais.",
    category: "media",
    searchTerms: ["social", "redes", "instagram", "facebook", "icons"],
    icon: <Share2Icon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setSocialLinks().run(),
    toJSON: () => ({ type: "socialLinks" }),
  },
  {
    id: "youtube",
    title: "YouTube",
    description: "Thumbnail clicável de um vídeo do YouTube.",
    category: "media",
    searchTerms: ["youtube", "video", "embed"],
    icon: <YoutubeIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setYoutube().run(),
    toJSON: () => ({ type: "youtube" }),
  },
  {
    id: "twitter",
    title: "Post do X",
    description: "Card de um post do X (Twitter).",
    category: "media",
    searchTerms: ["x", "twitter", "tweet", "post"],
    icon: <TwitterIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setTwitter().run(),
    toJSON: () => ({ type: "twitter" }),
  },
  {
    id: "chart",
    title: "Gráfico",
    description: "Gráfico de barras/linha/pizza como imagem.",
    category: "media",
    searchTerms: ["chart", "grafico", "barra", "pizza"],
    icon: <BarChart3Icon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setChart().run(),
    toJSON: () => ({ type: "chart" }),
  },

  // --------------------------------------------------------- Layout (cont)
  {
    id: "horizontalRule",
    title: "Divisor",
    description: "Adicione um divisor.",
    category: "layout",
    searchTerms: ["horizontal", "rule", "divisor"],
    icon: <SquareSplitVerticalIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setHorizontalRule().run(),
    toJSON: () => ({ type: "horizontalRule" }),
  },
  {
    id: "spacer",
    title: "Espaçador",
    description: "Adicione um espaço vertical.",
    category: "layout",
    searchTerms: ["spacer", "espaco", "gap"],
    icon: <MoveVerticalIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setSpacer().run(),
    toJSON: () => ({ type: "spacer" }),
  },
  {
    id: "hardBreak",
    title: "Quebra de linha",
    description: "Adicione uma quebra entre linhas.",
    category: "layout",
    searchTerms: ["break", "line", "quebra"],
    icon: <DivideIcon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setHardBreak().run(),
  },

  // ----------------------------------------------------------- Utilitário
  {
    id: "variable",
    title: "Variável",
    description: "Adicione uma variável.",
    category: "utility",
    searchTerms: ["variable", "variavel"],
    shortcut: "{{",
    icon: <VariableIcon className="h-4 w-4" />,
    requiresInteraction: true,
    insert: (editor, opts) => chain(editor, opts).insertContent("{{").run(),
  },
  {
    id: "html",
    title: "HTML",
    description: "Insira um bloco de HTML personalizado.",
    category: "utility",
    searchTerms: ["html", "code", "custom"],
    icon: <Code2Icon className="h-4 w-4" />,
    insert: (editor, opts) => chain(editor, opts).setHtmlBlock().run(),
    toJSON: () => ({ type: "html" }),
  },
  {
    id: "clearLine",
    title: "Limpar linha",
    description: "Limpe a linha atual.",
    category: "utility",
    searchTerms: ["clear", "line", "limpar"],
    icon: <EraserIcon className="h-4 w-4" />,
    // Ação sobre o conteúdo existente, não um bloco novo: sem toJSON.
    insert: (editor) =>
      editor.chain().focus().selectParentNode().deleteSelection().run(),
  },
  {
    id: "unsubscribeFooter",
    title: "Rodapé de cancelamento",
    description: "Adicione um link de cancelamento de inscrição.",
    category: "utility",
    searchTerms: ["unsubscribe", "cancelamento"],
    icon: <UserXIcon className="h-4 w-4" />,
    insert: (editor, opts) =>
      chain(editor, opts)
        .setHorizontalRule()
        .insertContent(UNSUBSCRIBE_HTML)
        .run(),
  },
];

function columnsJSON(count: number): JSONContent {
  return {
    type: "columns",
    content: Array.from({ length: count }, () => ({
      type: "column",
      content: [{ type: "paragraph" }],
    })),
  };
}

export const UNSUBSCRIBE_HTML = `<unsub data-unsend-component='unsubscribe-footer'><p>Você está recebendo este e-mail porque se inscreveu através do nosso site.<br/><br/><a href="{{usesend_unsubscribe_url}}">Cancelar inscrição da lista</a></p><br><br><p>Nome da empresa,<br/>00 nome da rua<br/>Cidade, Estado 000000</p></unsub>`;

export function getBlock(id: string): BlockDefinition | undefined {
  return BLOCK_REGISTRY.find((b) => b.id === id);
}

export function blocksByCategory(category: BlockCategory): BlockDefinition[] {
  return BLOCK_REGISTRY.filter((b) => b.category === category);
}

/** Blocos que podem ser arrastados da paleta para o corpo do e-mail. */
export function draggableBlocks(): BlockDefinition[] {
  return BLOCK_REGISTRY.filter((b) => b.toJSON && !b.requiresInteraction);
}
