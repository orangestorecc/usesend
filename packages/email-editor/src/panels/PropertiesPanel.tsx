import { useState } from "react";

import { useEditorChrome } from "../context/EditorChromeContext";
import { SegmentedControl } from "../controls";
import { PageStylePanel } from "./PageStylePanel";
import { PANEL_BY_NODE, TextBlockPanel } from "./BlockPanels";
import { useSelectedNode } from "./useSelectedNode";

/**
 * Painel direito: propriedades do bloco sob o cursor, ou o estilo da página.
 *
 * A spec previa `selected === null → PageStylePanel`, mas na prática sempre há
 * um cursor em algum bloco de texto — o painel de texto nunca apareceria e o
 * estilo da página ficaria preso. Daí a alternância explícita entre as duas
 * visões, com "Bloco" como padrão.
 */
export function PropertiesPanel() {
  const { editor } = useEditorChrome();
  const selected = useSelectedNode(editor);
  const [aba, setAba] = useState<"bloco" | "pagina">("bloco");

  if (!editor) return null;

  const Painel = selected ? PANEL_BY_NODE[selected.typeName] : undefined;

  return (
    <div>
      <div className="px-4 pt-3">
        <SegmentedControl
          value={aba}
          options={[
            { value: "bloco", label: <span className="text-xs">Bloco</span> },
            { value: "pagina", label: <span className="text-xs">Página</span> },
          ]}
          onChange={setAba}
        />
      </div>

      {aba === "pagina" ? (
        <PageStylePanel />
      ) : Painel && selected ? (
        <Painel editor={editor} selected={selected} />
      ) : (
        <TextBlockPanel editor={editor} />
      )}
    </div>
  );
}
