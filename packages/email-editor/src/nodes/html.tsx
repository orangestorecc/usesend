import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState } from "react";

export function HtmlComponent({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const html = (node.attrs.html as string) ?? "";
  const [editing, setEditing] = useState(!html);

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className={`my-2 overflow-hidden rounded border ${
          selected ? "border-blue-400" : "border-gray-200"
        }`}
      >
        <div className="flex items-center justify-between border-b bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
          <span className="font-medium">HTML</span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded px-1.5 py-0.5 hover:bg-gray-200"
          >
            {editing ? "Prévia" : "Editar"}
          </button>
        </div>
        {editing ? (
          <textarea
            value={html}
            onChange={(e) => updateAttributes({ html: e.target.value })}
            placeholder="<div>Seu HTML aqui</div>"
            spellCheck={false}
            className="min-h-[120px] w-full resize-y bg-white p-2 font-mono text-xs outline-none"
          />
        ) : (
          <div
            className="p-2 text-sm"
            dangerouslySetInnerHTML={{
              __html:
                html ||
                '<span style="color:#9ca3af">Bloco HTML vazio — clique em Editar.</span>',
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}
