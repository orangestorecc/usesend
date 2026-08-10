import { useEditorChrome } from "../context/EditorChromeContext";
import type { BlockDefinition } from "../blocks/registry";

/** MIME próprio: distingue o arrasto vindo da paleta do arrasto interno do
 *  editor (feito pelo drag handle), que usa os tipos padrão do ProseMirror. */
export const BLOCK_MIME = "application/x-madmail-block";

/**
 * Item da paleta. Clicar insere no fim do documento; arrastar solta na
 * posição escolhida (tratado por BlockDropExtension).
 */
export function DraggableBlockItem({
  block,
  onInserted,
}: {
  block: BlockDefinition;
  onInserted?: () => void;
}) {
  const { editor, uploadImage } = useEditorChrome();
  const draggable = Boolean(block.toJSON) && !block.requiresInteraction;

  const insert = () => {
    if (!editor) return;
    editor.chain().focus().run();
    block.insert(editor, { uploadImage });
    onInserted?.();
  };

  return (
    <button
      type="button"
      draggable={draggable}
      onClick={insert}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData(BLOCK_MIME, block.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
      title={block.description}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background text-muted-foreground">
        {block.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{block.title}</span>
      {block.shortcut ? (
        <span className="shrink-0 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
          {block.shortcut}
        </span>
      ) : null}
    </button>
  );
}
