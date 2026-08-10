import { Editor } from "@tiptap/react";

export interface MenuProps {
  editor: Editor;
  appendTo?: React.RefObject<any>;
  shouldHide?: boolean;
}

export type AllowedAlignments = "left" | "center" | "right";

export interface ButtonOptions {
  text: string;
  url: string;
  alignment: AllowedAlignments;
  borderRadius: string;
  borderColor: string;
  borderWidth: string;
  buttonColor: string;
  textColor: string;
  HTMLAttributes: Record<string, any>;
}

export interface ImageOptions {
  altText: string;
  url: string;
  alignment: AllowedAlignments;
  borderRadius: string;
  borderColor: string;
  borderWidth: string;
  HTMLAttributes: Record<string, any>;
}

export type SVGProps = React.SVGProps<SVGSVGElement>;

/**
 * Estilo global do e-mail, guardado no atributo `pageStyle` do nó raiz.
 *
 * Vive aqui (módulo puro, sem side effect) porque o EmailRenderer também
 * consome esse tipo e roda no servidor — não pode importar nada de UI.
 *
 * Todos os campos são opcionais. Os defaults em PAGE_STYLE_DEFAULTS
 * reproduzem exatamente o HTML gerado antes destes campos existirem, para
 * que e-mails já salvos não mudem de aparência.
 */
export type PageStyle = {
  /** Fundo da área externa (<body>). */
  backgroundColor?: string;
  /** Preenchimento da área externa. */
  pagePadding?: string;
  /** Fundo do bloco de conteúdo. */
  contentBackground?: string;
  /** Cor de texto padrão do conteúdo. */
  textColor?: string;
  /** Alinhamento do conteúdo dentro do e-mail. */
  contentAlign?: "left" | "center" | "right";
  contentWidth?: string;
  contentHeight?: string;
  contentPadding?: string;
  contentMargin?: string;
  contentBorderRadius?: string;
  contentBorderWidth?: string;
  contentBorderColor?: string;
  fontFamily?: string;
};

/**
 * ATENÇÃO: `contentPadding` precisa continuar "0.5rem". Era um valor fixo no
 * <Container> do renderer; trocar por "0" mudaria a aparência de todos os
 * e-mails já salvos.
 */
export const PAGE_STYLE_DEFAULTS = {
  contentWidth: "600px",
  contentPadding: "0.5rem",
  contentAlign: "center" as const,
};
