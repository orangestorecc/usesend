import {
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
import type { SocialLink } from "../extensions/SocialLinksExtension";
import { SOCIAL_PLATFORMS, socialIconUrl } from "../lib/embed-helpers";

export function SocialLinksComponent({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const links = (node.attrs.links as SocialLink[]) ?? [];
  const align = (node.attrs.align as string) ?? "center";
  const size = (node.attrs.size as number) ?? 32;

  const setLink = (idx: number, patch: Partial<SocialLink>) => {
    const next = links.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    updateAttributes({ links: next });
  };
  const addLink = () =>
    updateAttributes({ links: [...links, { platform: "instagram", url: "" }] });
  const removeLink = (idx: number) =>
    updateAttributes({ links: links.filter((_, i) => i !== idx) });

  return (
    <NodeViewWrapper className="react-component my-2">
      <div
        contentEditable={false}
        className={`relative rounded ${selected ? "ring-2 ring-blue-300" : ""}`}
        style={{ textAlign: align as any }}
      >
        {selected ? (
          <div className="absolute -top-3 right-2 z-10">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs shadow-sm">
                  <Settings2Icon className="h-3.5 w-3.5" /> Redes
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-2" side="top">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <select
                      value={l.platform}
                      onChange={(e) => setLink(i, { platform: e.target.value })}
                      className="rounded border px-1 py-1 text-xs"
                    >
                      {Object.entries(SOCIAL_PLATFORMS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={l.url}
                      placeholder="https://…"
                      onChange={(e) => setLink(i, { url: e.target.value })}
                      className="h-8 flex-1 text-xs"
                    />
                    <button
                      onClick={() => removeLink(i)}
                      className="px-1 text-xs text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={addLink}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    + Adicionar
                  </button>
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => updateAttributes({ align: a })}
                        className={`rounded border px-2 py-1 text-xs ${
                          align === a ? "border-blue-400 bg-blue-50" : ""
                        }`}
                      >
                        {a[0]!.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
        <div style={{ display: "inline-flex", gap: 12 }}>
          {links.length === 0 ? (
            <span className="text-xs text-gray-400">Sem redes — clique para configurar</span>
          ) : (
            links.map((l, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={socialIconUrl(l.platform, 64)}
                alt={l.platform}
                width={size}
                height={size}
                style={{ width: size, height: size }}
              />
            ))
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
