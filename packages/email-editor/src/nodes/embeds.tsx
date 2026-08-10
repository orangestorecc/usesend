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
import { Settings2Icon, PlayIcon } from "lucide-react";
import { youtubeId, quickChartUrl } from "../lib/embed-helpers";

function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute -top-3 right-2 z-10">
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs shadow-sm">
            <Settings2Icon className="h-3.5 w-3.5" /> Editar
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-2" side="top">
          {children}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function YoutubeComponent({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const url = (node.attrs.url as string) ?? "";
  const id = youtubeId(url);
  return (
    <NodeViewWrapper className="react-component my-2">
      <div
        contentEditable={false}
        className={`relative rounded ${selected ? "ring-2 ring-blue-300" : ""}`}
        style={{ textAlign: (node.attrs.align as any) ?? "center" }}
      >
        {selected ? (
          <Toolbar>
            <span className="text-xs text-muted-foreground">URL do vídeo</span>
            <Input
              value={url}
              placeholder="https://youtube.com/watch?v=…"
              onChange={(e) => updateAttributes({ url: e.target.value })}
            />
          </Toolbar>
        ) : null}
        {id ? (
          <div style={{ position: "relative", display: "inline-block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
              alt="YouTube"
              style={{ maxWidth: "100%", borderRadius: 8 }}
            />
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlayIcon className="h-12 w-12 fill-white text-white drop-shadow" />
            </span>
          </div>
        ) : (
          <div className="rounded border border-dashed p-8 text-sm text-gray-400">
            Cole a URL de um vídeo do YouTube
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export function TwitterComponent({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { url = "", username = "", text = "" } = node.attrs as {
    url: string;
    username: string;
    text: string;
  };
  return (
    <NodeViewWrapper className="react-component my-2">
      <div
        contentEditable={false}
        className={`relative rounded ${selected ? "ring-2 ring-blue-300" : ""}`}
      >
        {selected ? (
          <Toolbar>
            <span className="text-xs text-muted-foreground">@usuário</span>
            <Input
              value={username}
              placeholder="usuario"
              onChange={(e) => updateAttributes({ username: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">Texto do post</span>
            <Input
              value={text}
              placeholder="Conteúdo do post…"
              onChange={(e) => updateAttributes({ text: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">Link (URL)</span>
            <Input
              value={url}
              placeholder="https://x.com/…"
              onChange={(e) => updateAttributes({ url: e.target.value })}
            />
          </Toolbar>
        ) : null}
        <div className="mx-auto max-w-md rounded-xl border p-4 text-left">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
              𝕏
            </span>
            {username ? `@${username}` : "@usuário"}
          </div>
          <p className="mt-2 text-sm">{text || "Texto do post aqui…"}</p>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

const CHART_TYPES = ["bar", "line", "pie", "doughnut"];

export function ChartComponent({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const attrs = node.attrs as {
    chartType: string;
    title: string;
    labels: string;
    values: string;
    color: string;
    align: string;
  };
  return (
    <NodeViewWrapper className="react-component my-2">
      <div
        contentEditable={false}
        className={`relative rounded ${selected ? "ring-2 ring-blue-300" : ""}`}
        style={{ textAlign: (attrs.align as any) ?? "center" }}
      >
        {selected ? (
          <Toolbar>
            <div className="flex gap-1">
              {CHART_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => updateAttributes({ chartType: t })}
                  className={`flex-1 rounded border px-1 py-1 text-xs capitalize ${
                    attrs.chartType === t ? "border-blue-400 bg-blue-50" : ""
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Título</span>
            <Input
              value={attrs.title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">
              Rótulos (vírgula)
            </span>
            <Input
              value={attrs.labels}
              onChange={(e) => updateAttributes({ labels: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">
              Valores (vírgula)
            </span>
            <Input
              value={attrs.values}
              onChange={(e) => updateAttributes({ values: e.target.value })}
            />
          </Toolbar>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={quickChartUrl(attrs)}
          alt={attrs.title || "Gráfico"}
          style={{ maxWidth: "100%", borderRadius: 8 }}
        />
      </div>
    </NodeViewWrapper>
  );
}
