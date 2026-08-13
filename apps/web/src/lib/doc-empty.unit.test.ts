import { describe, expect, it } from "vitest";
import { isDocEmpty } from "@usesend/email-editor/src/lib/doc-empty";

describe("isDocEmpty", () => {
  it("trata ausência de documento como vazio", () => {
    expect(isDocEmpty(undefined)).toBe(true);
    expect(isDocEmpty(null)).toBe(true);
  });

  it("trata o parágrafo vazio do autosave do TipTap como vazio", () => {
    expect(isDocEmpty({ type: "doc", content: [{ type: "paragraph" }] })).toBe(
      true,
    );
  });

  it("trata parágrafo só com espaços como vazio", () => {
    expect(
      isDocEmpty({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "   " }] },
        ],
      }),
    ).toBe(true);
  });

  it("texto de verdade conta como conteúdo", () => {
    expect(
      isDocEmpty({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Olá" }] },
        ],
      }),
    ).toBe(false);
  });

  it("bloco sem texto (spacer, imagem) conta como conteúdo", () => {
    expect(
      isDocEmpty({ type: "doc", content: [{ type: "spacer", attrs: {} }] }),
    ).toBe(false);
    expect(
      isDocEmpty({
        type: "doc",
        content: [{ type: "image", attrs: { src: "x.png" } }],
      }),
    ).toBe(false);
  });

  it("enxerga conteúdo aninhado dentro de section/columns", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [],
        },
      ],
    };
    expect(isDocEmpty(doc)).toBe(true);
  });
});
