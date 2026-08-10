import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@usesend/ui/src/popover";
import { Input } from "@usesend/ui/src/input";
import { Settings2Icon } from "lucide-react";
import { ColorPickerPopup } from "../components/ui/ColorPicker";

const PADDINGS = [
  { label: "Pequeno", value: "12px" },
  { label: "Médio", value: "24px" },
  { label: "Grande", value: "40px" },
];

export function SectionComponent({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const {
    backgroundColor = "#f4f4f5",
    padding = "24px",
    borderRadius = "8px",
    align = "left",
  } = node.attrs as {
    backgroundColor: string;
    padding: string;
    borderRadius: string;
    align: string;
  };

  return (
    <NodeViewWrapper className="react-component relative my-2">
      {selected ? (
        <div
          contentEditable={false}
          className="absolute -top-3 right-2 z-10"
        >
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs shadow-sm">
                <Settings2Icon className="h-3.5 w-3.5" /> Seção
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3" side="top">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Fundo</span>
                <ColorPickerPopup
                  color={backgroundColor}
                  onChange={(c) => updateAttributes({ backgroundColor: c })}
                  trigger={
                    <button
                      className="h-6 w-6 rounded border"
                      style={{ backgroundColor }}
                    />
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  Preenchimento
                </span>
                <div className="flex gap-1">
                  {PADDINGS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => updateAttributes({ padding: p.value })}
                      className={`flex-1 rounded border px-2 py-1 text-xs ${
                        padding === p.value ? "border-blue-400 bg-blue-50" : ""
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  Arredondamento (px)
                </span>
                <Input
                  value={parseInt(borderRadius) || 0}
                  type="number"
                  onChange={(e) =>
                    updateAttributes({ borderRadius: `${e.target.value}px` })
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  Alinhamento
                </span>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => updateAttributes({ align: a })}
                      className={`flex-1 rounded border px-2 py-1 text-xs capitalize ${
                        align === a ? "border-blue-400 bg-blue-50" : ""
                      }`}
                    >
                      {a === "left"
                        ? "Esq."
                        : a === "center"
                          ? "Centro"
                          : "Dir."}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
      <div style={{ backgroundColor, padding, borderRadius, textAlign: align as any }}>
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}
