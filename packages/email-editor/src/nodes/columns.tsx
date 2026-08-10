import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";

/** Container de colunas: layout flex; cada filho é uma coluna. */
export function ColumnsComponent({ node }: NodeViewProps) {
  const gap = (node.attrs.gap as string) ?? "16px";
  return (
    <NodeViewWrapper className="react-component my-2">
      <NodeViewContent
        className="flex flex-col sm:flex-row"
        style={{ gap }}
      />
    </NodeViewWrapper>
  );
}

/** Coluna individual (flex-1). */
export function ColumnComponent(_: NodeViewProps) {
  return (
    <NodeViewWrapper
      className="flex-1 rounded border border-dashed border-gray-200 p-2"
      style={{ minWidth: 0 }}
    >
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
