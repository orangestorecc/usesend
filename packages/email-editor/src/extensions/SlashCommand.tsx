import { Editor, Extension, Range, ReactRenderer } from "@tiptap/react";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { cn } from "@usesend/ui/lib/utils";
import {
  Code2Icon,
  CodeIcon,
  DivideIcon,
  EraserIcon,
  MoveVerticalIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ListIcon,
  ListOrderedIcon,
  RectangleEllipsisIcon,
  SquareSplitVerticalIcon,
  TextIcon,
  TextQuoteIcon,
  UserXIcon,
  VariableIcon,
} from "lucide-react";
import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import tippy, { GetReferenceClientRect } from "tippy.js";
import { UploadFn } from "./ImageExtension";

export interface CommandProps {
  editor: Editor;
  range: Range;
}

interface CommandItemProps {
  title: string;
  description: string;
  icon: ReactNode;
  section?: string;
  shortcut?: string;
}

export type SlashCommandItem = {
  title: string;
  description: string;
  searchTerms: string[];
  icon: ReactNode;
  command: (options: CommandProps) => void;
  /** Seção de agrupamento no menu (Texto, Mídia, Layout, Utilitário). */
  section?: string;
  /** Atalho markdown exibido à direita (ex: #, ##, -, >). */
  shortcut?: string;
};

export const SlashCommand = Extension.create({
  name: "slash-command",
  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: any;
        }) => {
          props.command({ editor, range });
        },
      },
      uploadImage: undefined as UploadFn | undefined,
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

const DEFAULT_SLASH_COMMANDS = (uploadImage?: UploadFn): SlashCommandItem[] => [
  {
    title: "Texto",
    description: "Comece a digitar com texto simples.",
    searchTerms: ["p", "paragraph", "texto"],
    section: "Texto",
    icon: <TextIcon className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode("paragraph", "paragraph")
        .run();
    },
  },
  {
    title: "Título 1",
    description: "Título de seção grande.",
    searchTerms: ["title", "big", "large", "titulo", "h1"],
    section: "Texto",
    shortcut: "#",
    icon: <Heading1Icon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run();
    },
  },
  {
    title: "Título 2",
    description: "Título de seção médio.",
    searchTerms: ["subtitle", "medium", "subtitulo", "h2"],
    section: "Texto",
    shortcut: "##",
    icon: <Heading2Icon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run();
    },
  },
  {
    title: "Título 3",
    description: "Título de seção pequeno.",
    searchTerms: ["subtitle", "small", "h3"],
    section: "Texto",
    shortcut: "###",
    icon: <Heading3Icon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run();
    },
  },
  {
    title: "Lista com marcadores",
    description: "Crie uma lista com marcadores simples.",
    searchTerms: ["unordered", "point", "lista", "bullet"],
    section: "Texto",
    shortcut: "-",
    icon: <ListIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Lista numerada",
    description: "Crie uma lista com numeração.",
    searchTerms: ["ordered", "numerada"],
    section: "Texto",
    shortcut: "1.",
    icon: <ListOrderedIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Citação",
    description: "Adicione uma citação.",
    searchTerms: ["quote", "blockquote", "citacao"],
    section: "Texto",
    shortcut: ">",
    icon: <TextQuoteIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Bloco de código",
    description: "Adicione código.",
    searchTerms: ["code", "codigo"],
    section: "Texto",
    icon: <CodeIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Imagem",
    description: "Imagem em largura total",
    searchTerms: ["image", "imagem"],
    section: "Mídia",
    icon: <ImageIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      if (uploadImage) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async () => {
          const file = input.files?.[0];
          if (file && uploadImage) {
            editor.chain().focus().deleteRange(range).run();
            const placeholder = URL.createObjectURL(file);
            editor
              .chain()
              .focus()
              .setImage({ src: placeholder })
              .updateAttributes("image", { isUploading: true })
              .run();
            try {
              console.log("before upload");
              const url = await uploadImage(file);
              editor
                .chain()
                .focus()
                .updateAttributes("image", { src: url, isUploading: false })
                .run();
            } catch (e) {
              editor.chain().focus().deleteNode("image").run();
              console.error("Failed to upload image:", e);
            }
          }
        };
        input.click();
      } else {
        const imageUrl = prompt("URL da imagem: ") || "";

        if (!imageUrl) {
          return;
        }

        editor.chain().focus().deleteRange(range).run();
        editor.chain().focus().setImage({ src: imageUrl }).run();
      }
    },
  },
  {
    title: "Botão",
    description: "Adicione um botão.",
    searchTerms: ["button", "botao"],
    section: "Layout",
    icon: <RectangleEllipsisIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).setButton().run();
    },
  },
  {
    title: "Divisor",
    description: "Adicione um divisor.",
    searchTerms: ["horizontal", "rule", "divisor"],
    section: "Layout",
    icon: <SquareSplitVerticalIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Espaçador",
    description: "Adicione um espaço vertical.",
    searchTerms: ["spacer", "espaco", "gap"],
    section: "Layout",
    icon: <MoveVerticalIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).setSpacer().run();
    },
  },
  {
    title: "Quebra de linha",
    description: "Adicione uma quebra entre linhas.",
    searchTerms: ["break", "line", "quebra"],
    section: "Layout",
    icon: <DivideIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).setHardBreak().run();
    },
  },
  {
    title: "Variável",
    description: "Adicione uma variável.",
    searchTerms: ["variable", "variavel"],
    section: "Utilitário",
    shortcut: "{{",
    icon: <VariableIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).insertContent("{{").run();
    },
  },
  {
    title: "HTML",
    description: "Insira um bloco de HTML personalizado.",
    searchTerms: ["html", "code", "custom"],
    section: "Utilitário",
    icon: <Code2Icon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().deleteRange(range).setHtmlBlock().run();
    },
  },
  {
    title: "Limpar linha",
    description: "Limpe a linha atual.",
    searchTerms: ["clear", "line", "limpar"],
    section: "Utilitário",
    icon: <EraserIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor.chain().focus().selectParentNode().deleteSelection().run();
    },
  },
  {
    title: "Rodapé de cancelamento",
    description: "Adicione um link de cancelamento de inscrição.",
    searchTerms: ["unsubscribe", "cancelamento"],
    section: "Utilitário",
    icon: <UserXIcon className="h-4 w-4" />,
    command: ({ editor, range }: CommandProps) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHorizontalRule()
        .insertContent(
          `<unsub data-unsend-component='unsubscribe-footer'><p>Você está recebendo este e-mail porque se inscreveu através do nosso site.<br/><br/><a href="{{usesend_unsubscribe_url}}">Cancelar inscrição da lista</a></p><br><br><p>Nome da empresa,<br/>00 nome da rua<br/>Cidade, Estado 000000</p></unsub>`
        )
        .run();
    },
  },
];

export const updateScrollView = (container: HTMLElement, item: HTMLElement) => {
  const containerHeight = container.offsetHeight;
  const itemHeight = item ? item.offsetHeight : 0;

  const top = item.offsetTop;
  const bottom = top + itemHeight;

  if (top < container.scrollTop) {
    container.scrollTop -= container.scrollTop - top + 5;
  } else if (bottom > containerHeight + container.scrollTop) {
    container.scrollTop += bottom - containerHeight - container.scrollTop + 5;
  }
};

const CommandList = ({
  items,
  command,
  editor,
}: {
  items: CommandItemProps[];
  command: (item: CommandItemProps) => void;
  editor: Editor;
  range: any;
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [command, editor, items]
  );

  useEffect(() => {
    const navigationKeys = ["ArrowUp", "ArrowDown", "Enter"];
    const onKeyDown = (e: KeyboardEvent) => {
      if (navigationKeys.includes(e.key)) {
        e.preventDefault();
        if (e.key === "ArrowUp") {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length);
          return true;
        }
        if (e.key === "ArrowDown") {
          setSelectedIndex((selectedIndex + 1) % items.length);
          return true;
        }
        if (e.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [items, selectedIndex, setSelectedIndex, selectItem]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const commandListContainer = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = commandListContainer?.current;

    const item = container?.children[selectedIndex] as HTMLElement;

    if (item && container) updateScrollView(container, item);
  }, [selectedIndex]);

  return items.length > 0 ? (
    <div className="z-50 w-64 rounded-lg border border-gray-200 bg-white shadow-md transition-all">
      <div
        id="slash-command"
        ref={commandListContainer}
        className="no-scrollbar h-auto max-h-[330px] overflow-y-auto scroll-smooth px-1 py-1.5"
      >
        {items.map((item: CommandItemProps, index: number) => {
          const prevSection = items[index - 1]?.section;
          const showHeader = item.section && item.section !== prevSection;
          return (
            <div key={index}>
              {showHeader ? (
                <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-orange-500/90">
                  {item.section}
                </div>
              ) : null}
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100",
                  index === selectedIndex ? "bg-gray-100" : "bg-transparent"
                )}
                onClick={() => selectItem(index)}
                type="button"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-600">
                  {item.icon}
                </div>
                <span className="flex-1 font-medium">{item.title}</span>
                {item.shortcut ? (
                  <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-500">
                    {item.shortcut}
                  </kbd>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;
};

export function getSlashCommandSuggestions(
  commands: SlashCommandItem[] = [],
  uploadImage?: UploadFn
): Omit<SuggestionOptions, "editor"> {
  return {
    items: ({ query }) => {
      return [...DEFAULT_SLASH_COMMANDS(uploadImage), ...commands].filter(
        (item) => {
          if (typeof query === "string" && query.length > 0) {
            const search = query.toLowerCase();
            return (
              item.title.toLowerCase().includes(search) ||
              item.description.toLowerCase().includes(search) ||
              (item.searchTerms &&
                item.searchTerms.some((term: string) => term.includes(search)))
            );
          }
          return true;
        }
      );
    },
    render: () => {
      let component: ReactRenderer<any>;
      let popup: InstanceType<any> | null = null;

      return {
        onStart: (props) => {
          component = new ReactRenderer(CommandList, {
            props,
            editor: props.editor,
          });

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect as GetReferenceClientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
          });
        },
        onUpdate: (props) => {
          component?.updateProps(props);

          popup &&
            popup[0].setProps({
              getReferenceClientRect: props.clientRect,
            });
        },
        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            popup?.[0].hide();

            return true;
          }

          return component?.ref?.onKeyDown(props);
        },
        onExit: () => {
          if (!popup || !popup?.[0] || !component) {
            return;
          }

          popup?.[0].destroy();
          component?.destroy();
        },
      };
    },
  };
}
