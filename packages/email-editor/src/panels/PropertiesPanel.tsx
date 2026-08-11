import { useEditorChrome } from "../context/EditorChromeContext";
import { PageStylePanel } from "./PageStylePanel";
import { PANEL_BY_NODE, TextBlockPanel } from "./BlockPanels";
import { useSelectedNode } from "./useSelectedNode";

/**
 * Painel direito. Mostra as propriedades do bloco selecionado; sem bloco
 * com painel próprio, cai no estilo da página.
 */
export function PropertiesPanel() {
  const { editor } = useEditorChrome();
  const selected = useSelectedNode(editor);

  if (!editor) return null;
  if (!selected) return <PageStylePanel />;

  const Painel = PANEL_BY_NODE[selected.typeName];
  if (!Painel) return <TextBlockPanel editor={editor} />;

  return <Painel editor={editor} selected={selected} />;
}
