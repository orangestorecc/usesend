import { Editor, Extension, Range, ReactRenderer } from "@tiptap/react";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { cn } from "@usesend/ui/lib/utils";
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
import { BLOCK_REGISTRY, CATEGORY_LABEL } from "../blocks/registry";

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

/**
 * Itens do menu "/" derivados do registry de blocos.
 *
 * A ordem do BLOCK_REGISTRY define a ordem e os cabecalhos de secao do menu:
 * o CommandList mostra um cabecalho sempre que a secao muda em relacao ao item
 * anterior. Mexer na ordem do registry muda o menu.
 */
const DEFAULT_SLASH_COMMANDS = (uploadImage?: UploadFn): SlashCommandItem[] =>
  BLOCK_REGISTRY.map((block) => ({
    title: block.title,
    description: block.description,
    searchTerms: block.searchTerms,
    section: CATEGORY_LABEL[block.category],
    shortcut: block.shortcut,
    icon: block.icon,
    command: ({ editor, range }: CommandProps) =>
      block.insert(editor, { range, uploadImage }),
  }));


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
