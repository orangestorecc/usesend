import type { ReactElement } from "react";
import type { Editor as TipTapEditor } from "@tiptap/core";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
} from "lucide-react";

import {
  ColorField,
  NumberUnitField,
  PanelSection,
  Row,
  SegmentedControl,
  SelectField,
  TextAreaField,
  TextField,
} from "../controls";
import { updateNodeAttrs, type SelectedNode } from "./useSelectedNode";

/**
 * Painéis de propriedades por tipo de bloco.
 *
 * Todos os atributos aqui já existiam nas extensões — esta fase só dá a eles
 * uma UI unificada à direita. Os popovers dentro dos NodeViews continuam
 * funcionando até a fase de limpeza, para não regredir funcionalidade no meio
 * da migração.
 */

export type BlockPanelProps = {
  editor: TipTapEditor;
  selected: SelectedNode;
};

/** `attrs` do nó selecionado com fallback, já tipado como string. */
function str(selected: SelectedNode, key: string, fallback = ""): string {
  const v = selected.attrs[key];
  return v === null || v === undefined ? fallback : String(v);
}

/** Aplica um patch de atributos no nó selecionado. */
function usePatch(editor: TipTapEditor, selected: SelectedNode) {
  return (patch: Record<string, unknown>) =>
    updateNodeAttrs(editor, selected, patch);
}

const ALIGN_OPTIONS = [
  { value: "left" as const, label: <AlignLeftIcon className="h-3.5 w-3.5" />, title: "Esquerda" },
  { value: "center" as const, label: <AlignCenterIcon className="h-3.5 w-3.5" />, title: "Centro" },
  { value: "right" as const, label: <AlignRightIcon className="h-3.5 w-3.5" />, title: "Direita" },
];

/** Linha de alinhamento reutilizada por vários blocos. */
function AlignRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Row label="Alinhamento">
      <div className="flex-1">
        <SegmentedControl
          value={(value || "left") as "left" | "center" | "right"}
          options={ALIGN_OPTIONS}
          onChange={onChange}
        />
      </div>
    </Row>
  );
}

function SectionPanel({ editor, selected }: BlockPanelProps) {
  const patch = usePatch(editor, selected);
  return (
    <PanelSection title="Seção">
      <ColorField
        label="Fundo"
        value={str(selected, "backgroundColor")}
        onChange={(v) => patch({ backgroundColor: v })}
      />
      <NumberUnitField
        label="Preenchimento"
        value={str(selected, "padding")}
        onChange={(v) => patch({ padding: v })}
      />
      <NumberUnitField
        label="Arredondar"
        value={str(selected, "borderRadius")}
        onChange={(v) => patch({ borderRadius: v })}
      />
      <AlignRow
        value={str(selected, "align", "left")}
        onChange={(v) => patch({ align: v })}
      />
    </PanelSection>
  );
}

function ColumnsPanel({ editor, selected }: BlockPanelProps) {
  const patch = usePatch(editor, selected);
  return (
    <PanelSection title="Colunas">
      <NumberUnitField
        label="Espaçamento"
        value={str(selected, "gap")}
        onChange={(v) => patch({ gap: v })}
      />
    </PanelSection>
  );
}

function ColumnPanel({ editor, selected }: BlockPanelProps) {
  const patch = usePatch(editor, selected);
  return (
    <PanelSection title="Coluna">
      <NumberUnitField
        label="Largura"
        value={str(selected, "width")}
        placeholder="auto"
        onChange={(v) => patch({ width: v || null })}
      />
    </PanelSection>
  );
}

function ButtonPanel({ editor, selected }: BlockPanelProps) {
  const patch = usePatch(editor, selected);
  return (
    <PanelSection title="Botão">
      <TextField
        label="Texto"
        value={str(selected, "text")}
        onChange={(v) => patch({ text: v })}
      />
      <TextField
        label="Link"
        value={str(selected, "url")}
        placeholder="https://"
        onChange={(v) => patch({ url: v })}
      />
      <AlignRow
        value={str(selected, "alignment", "left")}
        onChange={(v) => patch({ alignment: v })}
      />
      <ColorField
        label="Fundo"
        value={str(selected, "buttonColor")}
        onChange={(v) => patch({ buttonColor: v })}
      />
      <ColorField
        label="Texto"
        value={str(selected, "textColor")}
        onChange={(v) => patch({ textColor: v })}
      />
      {/* borderRadius e borderWidth são guardados sem unidade neste node. */}
      <NumberUnitField
        label="Arredondar"
        value={str(selected, "borderRadius")}
        allowUnits={false}
        onChange={(v) => patch({ borderRadius: v.replace(/px$/, "") })}
      />
      <NumberUnitField
        label="Borda"
        value={str(selected, "borderWidth")}
        allowUnits={false}
        onChange={(v) => patch({ borderWidth: v.replace(/px$/, "") })}
      />
      <ColorField
        label="Cor da borda"
        value={str(selected, "borderColor")}
        onChange={(v) => patch({ borderColor: v })}
      />
    </PanelSection>
  );
}

function SpacerPanel({ editor, selected }: BlockPanelProps) {
  const patch = usePatch(editor, selected);
  return (
    <PanelSection title="Espaçador">
      <NumberUnitField
        label="Altura"
        value={str(selected, "height")}
        onChange={(v) => patch({ height: v })}
      />
    </PanelSection>
  );
}

function ImagePanel({ editor, selected }: BlockPanelProps) {
  const patch = usePatch(editor, selected);
  return (
    <PanelSection title="Imagem">
      <TextField
        label="Origem"
        value={str(selected, "src")}
        placeholder="https://"
        onChange={(v) => patch({ src: v })}
      />
      <TextField
        label="Texto alt"
        value={str(selected, "alt")}
        onChange={(v) => patch({ alt: v })}
      />
      <TextField
        label="Link"
        value={str(selected, "externalLink")}
        placeholder="https://"
        onChange={(v) => patch({ externalLink: v || null })}
      />
      <AlignRow
        value={str(selected, "alignment", "center")}
        onChange={(v) => patch({ alignment: v })}
      />
      {/* width/height do node são números puros, sem unidade. */}
      <NumberUnitField
        label="Largura"
        value={str(selected, "width")}
        allowUnits={false}
        onChange={(v) => patch({ width: v.replace(/px$/, "") })}
      />
      <NumberUnitField
        label="Altura"
        value={str(selected, "height")}
        allowUnits={false}
        placeholder="auto"
        onChange={(v) => patch({ height: v.replace(/px$/, "") })}
      />
      <NumberUnitField
        label="Arredondar"
        value={str(selected, "borderRadius")}
        allowUnits={false}
        onChange={(v) => patch({ borderRadius: v.replace(/px$/, "") })}
      />
      <NumberUnitField
        label="Borda"
        value={str(selected, "borderWidth")}
        allowUnits={false}
        onChange={(v) => patch({ borderWidth: v.replace(/px$/, "") })}
      />
      <ColorField
        label="Cor da borda"
        value={str(selected, "borderColor")}
        onChange={(v) => patch({ borderColor: v })}
      />
    </PanelSection>
  );
}

type SocialLink = { url?: string; icon?: string; title?: string };

function SocialLinksPanel({ editor, selected }: BlockPanelProps) {
  const patch = usePatch(editor, selected);
  const links = (selected.attrs.links as SocialLink[] | undefined) ?? [];

  const setLink = (i: number, url: string) => {
    const next = links.map((l, idx) => (idx === i ? { ...l, url } : l));
    patch({ links: next });
  };

  return (
    <PanelSection title="Redes sociais">
      <AlignRow
        value={str(selected, "align", "center")}
        onChange={(v) => patch({ align: v })}
      />
      <NumberUnitField
        label="Tamanho"
        value={str(selected, "size")}
        allowUnits={false}
        onChange={(v) => patch({ size: Number(v.replace(/px$/, "")) || 32 })}
      />
      {links.map((l, i) => (
        <TextField
          key={l.icon ?? i}
          label={l.title ?? l.icon ?? `Link ${i + 1}`}
          value={l.url ?? ""}
          placeholder="https://"
          onChange={(v) => setLink(i, v)}
        />
      ))}
    </PanelSection>
  );
}

function EmbedPanel({ editor, selected }: BlockPanelProps) {
  const patch = usePatch(editor, selected);
  const tipo = selected.typeName;

  return (
    <PanelSection
      title={
        tipo === "youtube" ? "YouTube" : tipo === "twitter" ? "Post do X" : "Gráfico"
      }
    >
      {tipo === "chart" ? (
        <>
          <SelectField
            label="Tipo"
            value={str(selected, "chartType", "bar")}
            options={[
              { value: "bar", label: "Barras" },
              { value: "line", label: "Linha" },
              { value: "pie", label: "Pizza" },
            ]}
            onChange={(v) => patch({ chartType: v })}
          />
          <TextField
            label="Título"
            value={str(selected, "title")}
            onChange={(v) => patch({ title: v })}
          />
          <TextField
            label="Rótulos"
            value={str(selected, "labels")}
            placeholder="Jan, Fev, Mar"
            onChange={(v) => patch({ labels: v })}
          />
          <TextField
            label="Valores"
            value={str(selected, "values")}
            placeholder="12, 19, 8"
            onChange={(v) => patch({ values: v })}
          />
          <ColorField
            label="Cor"
            value={str(selected, "color")}
            onChange={(v) => patch({ color: v })}
          />
        </>
      ) : (
        <TextField
          label="URL"
          value={str(selected, "url")}
          placeholder="https://"
          onChange={(v) => patch({ url: v })}
        />
      )}

      {tipo === "twitter" ? (
        <>
          <TextField
            label="Usuário"
            value={str(selected, "username")}
            onChange={(v) => patch({ username: v })}
          />
          <TextAreaField
            label="Texto"
            value={str(selected, "text")}
            rows={3}
            onChange={(v) => patch({ text: v })}
          />
        </>
      ) : null}

      <AlignRow
        value={str(selected, "align", "center")}
        onChange={(v) => patch({ align: v })}
      />
    </PanelSection>
  );
}

function HtmlPanel({ editor, selected }: BlockPanelProps) {
  const patch = usePatch(editor, selected);
  return (
    <PanelSection title="HTML">
      <TextAreaField
        value={str(selected, "html")}
        rows={10}
        placeholder="<div>…</div>"
        onChange={(v) => patch({ html: v })}
      />
    </PanelSection>
  );
}

/**
 * Painel do texto sob o cursor. Diferente dos demais, age por comandos do
 * TipTap (marks e nodes de texto não têm atributos próprios de bloco).
 */
export function TextBlockPanel({ editor }: { editor: TipTapEditor }) {
  const align =
    (["left", "center", "right"] as const).find((a) =>
      editor.isActive({ textAlign: a }),
    ) ?? "left";
  const nivel = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : editor.isActive("heading", { level: 3 })
        ? "3"
        : "p";
  const cor = (editor.getAttributes("textStyle").color as string) ?? "";

  return (
    <PanelSection title="Texto">
      <SelectField
        label="Estilo"
        value={nivel}
        options={[
          { value: "p", label: "Parágrafo" },
          { value: "1", label: "Título 1" },
          { value: "2", label: "Título 2" },
          { value: "3", label: "Título 3" },
        ]}
        onChange={(v) => {
          if (v === "p") editor.chain().focus().setParagraph().run();
          else
            editor
              .chain()
              .focus()
              .setNode("heading", { level: Number(v) })
              .run();
        }}
      />
      <AlignRow
        value={align}
        onChange={(v) => editor.chain().focus().setTextAlign(v).run()}
      />
      <ColorField
        label="Cor"
        value={cor}
        onChange={(v) =>
          v
            ? editor.chain().focus().setColor(v).run()
            : editor.chain().focus().unsetColor().run()
        }
      />
    </PanelSection>
  );
}

export const PANEL_BY_NODE: Record<
  string,
  (props: BlockPanelProps) => ReactElement
> = {
  section: SectionPanel,
  columns: ColumnsPanel,
  column: ColumnPanel,
  button: ButtonPanel,
  spacer: SpacerPanel,
  image: ImagePanel,
  socialLinks: SocialLinksPanel,
  youtube: EmbedPanel,
  twitter: EmbedPanel,
  chart: EmbedPanel,
  html: HtmlPanel,
};
