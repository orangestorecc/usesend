import { useRef } from "react";

import { useEditorChrome } from "../context/EditorChromeContext";
import { BLOCK_MIME, type BlockDefinition } from "../blocks/registry";

export { BLOCK_MIME };

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
  const ghostRef = useRef<HTMLDivElement>(null);
  const draggable = Boolean(block.toJSON) && !block.requiresInteraction;

  const insert = () => {
    if (!editor) return;
    editor.chain().focus().run();
    block.insert(editor, { uploadImage });
    onInserted?.();
  };

  return (
    <>
      <button
        type="button"
        draggable={draggable}
        onClick={insert}
        onDragStart={(e) => {
          if (!draggable) return;
          e.dataTransfer.setData(BLOCK_MIME, block.id);
          e.dataTransfer.effectAllowed = "copy";
          // Sem uma imagem própria o browser captura o botão, que sai cortado
          // pelo recorte do flyout da paleta.
          if (ghostRef.current) {
            e.dataTransfer.setDragImage(ghostRef.current, 12, 12);
          }
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

      {/* Precisa estar no DOM (e não `display:none`) no momento do dragstart. */}
      {draggable ? (
        <div
          ref={ghostRef}
          aria-hidden
          className="pointer-events-none fixed -top-[1000px] left-0 flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm text-foreground shadow-md"
        >
          <span className="text-muted-foreground">{block.icon}</span>
          <span>{block.title}</span>
        </div>
      ) : null}
    </>
  );
}
