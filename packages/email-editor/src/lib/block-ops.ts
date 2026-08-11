import type { Editor as TipTapEditor } from "@tiptap/core";

import { getBlock } from "../blocks/registry";

/**
 * Operações sobre um bloco inteiro, endereçado pela posição ANTES dele.
 *
 * Ficam aqui, e não como comandos do TipTap, porque o menu de contexto e os
 * atalhos precisam agir sobre um bloco específico — que nem sempre é o da
 * seleção atual (o menu abre pelo drag handle, sob o ponteiro).
 */

/** Índice do bloco em seu pai e a lista de irmãos, para mover sem sair do nível. */
function irmaos(editor: TipTapEditor, pos: number) {
  const $pos = editor.state.doc.resolve(pos);
  const pai = $pos.parent;
  const indice = $pos.index();
  return { pai, indice, paiInicio: $pos.start() };
}

/**
 * Move o bloco uma posição para cima (-1) ou para baixo (+1) dentro do pai.
 * Devolve false quando já está na ponta.
 */
export function moveBlock(
  editor: TipTapEditor,
  pos: number,
  direction: -1 | 1,
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;

  const { pai, indice, paiInicio } = irmaos(editor, pos);
  const alvo = indice + direction;
  if (alvo < 0 || alvo >= pai.childCount) return false;

  // Posição de destino calculada ANTES de remover: somando o tamanho dos
  // irmãos até o índice alvo. Fazer depois exigiria remapear à mão.
  let destino = paiInicio;
  for (let i = 0; i < alvo; i++) destino += pai.child(i)!.nodeSize;
  if (direction === 1) destino += pai.child(alvo)!.nodeSize;

  const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
  tr.insert(tr.mapping.map(destino), node);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Duplica o bloco logo abaixo dele. */
export function duplicateBlock(editor: TipTapEditor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;
  editor.view.dispatch(
    editor.state.tr.insert(pos + node.nodeSize, node.copy(node.content)),
  );
  return true;
}

/** Remove o bloco. */
export function deleteBlock(editor: TipTapEditor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;
  editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
  return true;
}

/**
 * Troca o bloco por outro do registry, preservando o texto quando ambos são
 * blocos de texto. O `insert` do registry age na seleção, então posicionamos o
 * cursor no bloco antes de chamá-lo.
 */
export function transformBlock(
  editor: TipTapEditor,
  pos: number,
  targetBlockId: string,
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  const block = getBlock(targetBlockId);
  if (!node || !block) return false;

  editor
    .chain()
    .focus()
    .setTextSelection(pos + 1)
    .run();
  block.insert(editor);
  return true;
}

/**
 * Bloco de nível mais alto que contém a seleção. É o alvo padrão dos atalhos
 * quando o menu não informou uma posição.
 */
export function blocoDaSelecao(
  editor: TipTapEditor,
): { pos: number; typeName: string } | null {
  const { $from } = editor.state.selection;
  if ($from.depth === 0) return null;
  return {
    pos: $from.before(1),
    typeName: $from.node(1).type.name,
  };
}
