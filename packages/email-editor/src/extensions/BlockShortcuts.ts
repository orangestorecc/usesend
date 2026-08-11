import { Extension } from "@tiptap/core";

import {
  blocoDaSelecao,
  deleteBlock,
  duplicateBlock,
  moveBlock,
} from "../lib/block-ops";

/**
 * Atalhos de bloco. Agem sobre o bloco de nível mais alto que contém o cursor.
 *
 * Não incluímos Del/Backspace: no TipTap eles já apagam a seleção, e
 * sequestrá-los quebraria a edição normal de texto.
 */
export const BlockShortcuts = Extension.create({
  name: "blockShortcuts",

  addKeyboardShortcuts() {
    const alvo = () => blocoDaSelecao(this.editor);

    return {
      "Alt-ArrowUp": () => {
        const b = alvo();
        return b ? moveBlock(this.editor, b.pos, -1) : false;
      },
      "Alt-ArrowDown": () => {
        const b = alvo();
        return b ? moveBlock(this.editor, b.pos, 1) : false;
      },
      "Mod-d": () => {
        const b = alvo();
        return b ? duplicateBlock(this.editor, b.pos) : false;
      },
      "Mod-Backspace": () => {
        const b = alvo();
        return b ? deleteBlock(this.editor, b.pos) : false;
      },
    };
  },
});

export default BlockShortcuts;
