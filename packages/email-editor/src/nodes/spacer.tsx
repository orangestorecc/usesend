import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

const SIZES = [
  { label: "Pequeno", value: "16px" },
  { label: "Médio", value: "24px" },
  { label: "Grande", value: "40px" },
  { label: "Extra", value: "64px" },
];

export function SpacerComponent({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const height = (node.attrs.height as string) ?? "24px";

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className={`group relative flex items-center justify-center rounded border border-dashed transition-colors ${
          selected
            ? "border-blue-400 bg-blue-50/40"
            : "border-transparent hover:border-gray-300"
        }`}
        style={{ height }}
      >
        <span className="pointer-events-none text-[10px] uppercase tracking-wide text-gray-400 opacity-0 group-hover:opacity-100">
          Espaçador
        </span>
        <select
          value={height}
          onChange={(e) => updateAttributes({ height: e.target.value })}
          className="absolute right-1 top-1 rounded border bg-white px-1 text-[11px] text-gray-600 opacity-0 group-hover:opacity-100"
        >
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </NodeViewWrapper>
  );
}
