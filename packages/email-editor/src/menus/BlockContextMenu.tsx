import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@usesend/ui/src/dropdown-menu";

import { useEditorChrome } from "../context/EditorChromeContext";
import { AiComposer } from "../chrome/AiComposer";
import { BLOCK_REGISTRY } from "../blocks/registry";
import {
  blocoDaSelecao,
  deleteBlock,
  duplicateBlock,
  moveBlock,
  transformBlock,
} from "../lib/block-ops";

type Alvo = { pos: number; typeName: string; x: number; y: number };

/** Blocos de texto oferecidos no "Transformar em". */
const TEXTO = new Set([
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
]);

const TIPOS_DE_TEXTO = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
]);

/**
 * Menu de ações do bloco.
 *
 * Gatilhos: clique no drag handle (elemento criado pelo plugin, fora da árvore
 * React — daí o listener no document), botão direito sobre o bloco e
 * `Ctrl/Cmd + .`. O menu é ancorado num ponto fixo na tela, não num elemento.
 */
export function BlockContextMenu() {
  const { editor } = useEditorChrome();
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [ia, setIa] = useState<Alvo | null>(null);

  /** Bloco de nível mais alto sob o ponto — mesma regra do drag and drop. */
  const blocoEm = useCallback(
    (clientX: number, clientY: number) => {
      if (!editor) return null;
      const coords = editor.view.posAtCoords({ left: clientX, top: clientY });
      if (!coords) return null;
      const $pos = editor.state.doc.resolve(
        coords.inside >= 0 ? coords.inside : coords.pos,
      );
      if ($pos.depth === 0) {
        const node = editor.state.doc.nodeAt(coords.inside);
        return node
          ? { pos: coords.inside, typeName: node.type.name }
          : null;
      }
      return { pos: $pos.before(1), typeName: $pos.node(1).type.name };
    },
    [editor],
  );

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    const onContextMenu = (e: MouseEvent) => {
      const b = blocoEm(e.clientX, e.clientY);
      if (!b) return;
      e.preventDefault();
      setAlvo({ ...b, x: e.clientX, y: e.clientY });
    };

    const onClick = (e: MouseEvent) => {
      const handle = (e.target as HTMLElement | null)?.closest?.(
        ".drag-handle, [data-drag-handle]",
      );
      if (!handle) return;
      const r = (handle as HTMLElement).getBoundingClientRect();
      // O handle fica à esquerda do bloco; sonda um pouco à direita dele.
      const b = blocoEm(r.right + 24, r.top + r.height / 2);
      if (!b) return;
      e.preventDefault();
      setAlvo({ ...b, x: r.left, y: r.bottom });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "." || !(e.ctrlKey || e.metaKey)) return;
      const b = blocoDaSelecao(editor);
      if (!b) return;
      e.preventDefault();
      const dm = editor.view.nodeDOM(b.pos);
      const r =
        dm instanceof HTMLElement
          ? dm.getBoundingClientRect()
          : dom.getBoundingClientRect();
      setAlvo({ ...b, x: r.left, y: r.bottom });
    };

    dom.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("click", onClick, true);
    dom.addEventListener("keydown", onKeyDown);
    return () => {
      dom.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("click", onClick, true);
      dom.removeEventListener("keydown", onKeyDown);
    };
  }, [editor, blocoEm]);

  if (!editor) return null;

  const fechar = () => setAlvo(null);
  const agir = (fn: () => void) => {
    fn();
    fechar();
  };

  const ehTexto = alvo ? TIPOS_DE_TEXTO.has(alvo.typeName) : false;
  const transformaveis = BLOCK_REGISTRY.filter((b) =>
    ehTexto ? TEXTO.has(b.id) : false,
  );

  return (
    <>
      {/* Âncora invisível: o menu segue o ponteiro, não um elemento do DOM. */}
      <DropdownMenu
        open={Boolean(alvo)}
        onOpenChange={(o) => !o && setAlvo(null)}
      >
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            style={{
              position: "fixed",
              left: alvo?.x ?? 0,
              top: alvo?.y ?? 0,
              width: 1,
              height: 1,
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {editor && alvo ? (
            <>
              <DropdownMenuItem
                onSelect={() => {
                  const a = alvo;
                  fechar();
                  setIa(a);
                }}
              >
                <SparklesIcon className="mr-2 h-3.5 w-3.5" />
                Editar com IA
              </DropdownMenuItem>

              {transformaveis.length ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Transformar em
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {transformaveis.map((b) => (
                      <DropdownMenuItem
                        key={b.id}
                        onSelect={() =>
                          agir(() => transformBlock(editor, alvo.pos, b.id))
                        }
                      >
                        <span className="mr-2">{b.icon}</span>
                        {b.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={() => agir(() => moveBlock(editor, alvo.pos, -1))}
              >
                <ArrowUpIcon className="mr-2 h-3.5 w-3.5" />
                Mover para cima
                <DropdownMenuShortcut>Alt+↑</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => agir(() => moveBlock(editor, alvo.pos, 1))}
              >
                <ArrowDownIcon className="mr-2 h-3.5 w-3.5" />
                Mover para baixo
                <DropdownMenuShortcut>Alt+↓</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => agir(() => duplicateBlock(editor, alvo.pos))}
              >
                <CopyIcon className="mr-2 h-3.5 w-3.5" />
                Duplicar
                <DropdownMenuShortcut>Ctrl+D</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => agir(() => deleteBlock(editor, alvo.pos))}
              >
                <Trash2Icon className="mr-2 h-3.5 w-3.5" />
                Excluir
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {ia ? (
        <div
          style={{ position: "fixed", left: ia.x, top: ia.y, zIndex: 50 }}
          className="rounded-md border bg-popover shadow-md"
        >
          <AiComposer
            variant="block"
            targetPos={ia.pos}
            onDone={() => setIa(null)}
          />
        </div>
      ) : null}
    </>
  );
}
