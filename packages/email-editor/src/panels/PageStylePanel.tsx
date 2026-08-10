import { AlignLeftIcon, AlignCenterIcon, AlignRightIcon } from "lucide-react";
import { useEditorChrome } from "../context/EditorChromeContext";
import type { PageStyle } from "../types";
import { PAGE_STYLE_DEFAULTS } from "../types";
import {
  ColorField,
  NumberUnitField,
  PanelSection,
  Row,
  SegmentedControl,
} from "../controls";

const FONTS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: '"Times New Roman", serif' },
  { label: "Courier", value: '"Courier New", monospace' },
];

/**
 * Estilo global do e-mail. Exibido quando nenhum bloco está selecionado.
 */
export function PageStylePanel() {
  const { editor } = useEditorChrome();
  const style = (editor?.state.doc.attrs.pageStyle ?? {}) as PageStyle;

  const set = (patch: Partial<PageStyle>) => {
    editor?.chain().focus().setPageStyle(patch).run();
  };

  return (
    <div className="divide-y">
      <PanelSection>
        <div className="pb-1 text-xs font-semibold">Estilo da página</div>
        <ColorField
          label="Fundo"
          value={style.backgroundColor}
          onChange={(v) => set({ backgroundColor: v })}
        />
        <NumberUnitField
          label="Preenchimento"
          value={style.pagePadding}
          onChange={(v) => set({ pagePadding: v })}
          placeholder="0"
        />
      </PanelSection>

      <PanelSection title="Conteúdo">
        <SegmentedControl
          value={style.contentAlign ?? PAGE_STYLE_DEFAULTS.contentAlign}
          onChange={(v) => set({ contentAlign: v })}
          options={[
            {
              value: "left",
              title: "Alinhar à esquerda",
              label: <AlignLeftIcon className="h-3.5 w-3.5" />,
            },
            {
              value: "center",
              title: "Centralizar",
              label: <AlignCenterIcon className="h-3.5 w-3.5" />,
            },
            {
              value: "right",
              title: "Alinhar à direita",
              label: <AlignRightIcon className="h-3.5 w-3.5" />,
            },
          ]}
        />
        <ColorField
          label="Texto"
          value={style.textColor}
          onChange={(v) => set({ textColor: v })}
          placeholder="#000000"
        />
        <ColorField
          label="Fundo"
          value={style.contentBackground}
          onChange={(v) => set({ contentBackground: v })}
        />
        <NumberUnitField
          label="Largura"
          value={style.contentWidth}
          onChange={(v) => set({ contentWidth: v })}
          placeholder={PAGE_STYLE_DEFAULTS.contentWidth}
        />
        <NumberUnitField
          label="Altura"
          value={style.contentHeight}
          onChange={(v) => set({ contentHeight: v })}
          placeholder="auto"
        />
        <NumberUnitField
          label="Preenchimento"
          value={style.contentPadding}
          onChange={(v) => set({ contentPadding: v })}
          placeholder={PAGE_STYLE_DEFAULTS.contentPadding}
        />
        <NumberUnitField
          label="Margem"
          value={style.contentMargin}
          onChange={(v) => set({ contentMargin: v })}
          placeholder="0"
        />
        <NumberUnitField
          label="Arredondar"
          value={style.contentBorderRadius}
          onChange={(v) => set({ contentBorderRadius: v })}
          placeholder="0"
        />
        <NumberUnitField
          label="Borda"
          value={style.contentBorderWidth}
          onChange={(v) => set({ contentBorderWidth: v })}
          placeholder="0"
        />
        <ColorField
          label="Cor da borda"
          value={style.contentBorderColor}
          onChange={(v) => set({ contentBorderColor: v })}
          placeholder="#000000"
        />
        <Row label="Fonte">
          <select
            value={style.fontFamily ?? FONTS[0]!.value}
            onChange={(e) => set({ fontFamily: e.target.value })}
            className="h-8 flex-1 rounded-md bg-muted px-2 text-xs outline-none"
          >
            {FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Row>
      </PanelSection>

      <PanelSection>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Arredondamento e sombras são ignorados pelo Outlook para computador.
          Evite depender deles para a leitura do e-mail.
        </p>
      </PanelSection>
    </div>
  );
}
