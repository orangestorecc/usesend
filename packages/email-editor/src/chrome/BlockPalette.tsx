import { useEffect, useRef, useState } from "react";
import {
  TypeIcon,
  ImageIcon,
  LayoutGridIcon,
  ParenthesesIcon,
} from "lucide-react";
import { cn } from "@usesend/ui/lib/utils";
import {
  blocksByCategory,
  CATEGORY_LABEL,
  type BlockCategory,
} from "../blocks/registry";
import { DraggableBlockItem } from "./DraggableBlockItem";

const CATEGORIES: Array<{
  key: BlockCategory;
  icon: typeof TypeIcon;
}> = [
  { key: "text", icon: TypeIcon },
  { key: "media", icon: ImageIcon },
  { key: "layout", icon: LayoutGridIcon },
  { key: "utility", icon: ParenthesesIcon },
];

/**
 * Paleta flutuante de blocos. Substitui a descoberta pelo menu "/", que
 * ficava escondido atrás de um contêiner com rolagem — os blocos de layout e
 * mídia simplesmente não apareciam sem rolar.
 */
export function BlockPalette() {
  const [open, setOpen] = useState<BlockCategory | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="sticky top-24 flex items-start gap-2 pl-2">
      <div className="flex flex-col gap-1 rounded-xl border bg-background p-1 shadow-sm">
        {CATEGORIES.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            title={CATEGORY_LABEL[key]}
            aria-label={CATEGORY_LABEL[key]}
            aria-expanded={open === key}
            onClick={() => setOpen(open === key ? null : key)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              open === key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {open ? (
        <div className="w-56 rounded-xl border bg-background p-1.5 shadow-lg">
          <div className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABEL[open]}
          </div>
          <div className="flex flex-col">
            {blocksByCategory(open).map((block) => (
              <DraggableBlockItem
                key={block.id}
                block={block}
                onInserted={() => setOpen(null)}
              />
            ))}
          </div>
          <p className="px-2 pb-1 pt-2 text-[11px] text-muted-foreground">
            Clique para inserir ou arraste para o e-mail.
          </p>
        </div>
      ) : null}
    </div>
  );
}
