import { HomeIcon, PencilIcon, CodeIcon } from "lucide-react";
import { cn } from "@usesend/ui/lib/utils";
import { useEditorChrome, type EditorMode } from "../context/EditorChromeContext";

/**
 * Trilho fino na borda esquerda: alterna entre editar e ver o HTML gerado.
 */
export function LeftRail({ onHome }: { onHome?: () => void }) {
  const { mode, setMode } = useEditorChrome();

  const item = (
    key: EditorMode,
    label: string,
    Icon: typeof PencilIcon,
  ) => (
    <button
      key={key}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={mode === key}
      onClick={() => setMode(key)}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        mode === key
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex h-full w-12 flex-col items-center gap-1 border-r bg-background py-3">
      {onHome ? (
        <button
          type="button"
          title="Voltar"
          aria-label="Voltar"
          onClick={onHome}
          className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <HomeIcon className="h-4 w-4" />
        </button>
      ) : null}
      {item("edit", "Editar", PencilIcon)}
      {item("code", "Ver HTML", CodeIcon)}
    </div>
  );
}
