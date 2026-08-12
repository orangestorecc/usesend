import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * As regras de validação do responsável financeiro, isoladas.
 *
 * Repete os schemas do router de propósito: o que importa aqui é travar o
 * comportamento (o que aceita, o que rejeita, como normaliza), e não a fiação
 * do tRPC.
 */

const whatsappSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine(
    (v) => v.length === 10 || v.length === 11,
    "Informe o WhatsApp com DDD, ex.: (81) 99999-9999",
  );

const documentoSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine(
    (v) => v.length === 0 || v.length === 11 || v.length === 14,
    "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)",
  );

describe("whatsapp", () => {
  it("aceita celular formatado e guarda só dígitos", () => {
    expect(whatsappSchema.parse("(81) 99999-8888")).toBe("81999998888");
  });

  it("aceita fixo com DDD", () => {
    expect(whatsappSchema.parse("(81) 3333-4444")).toBe("8133334444");
  });

  it("recusa número sem DDD", () => {
    expect(() => whatsappSchema.parse("99999-8888")).toThrow();
  });

  it("recusa número longo demais", () => {
    expect(() => whatsappSchema.parse("(81) 99999-88887")).toThrow();
  });
});

describe("documento", () => {
  it("aceita CPF formatado", () => {
    expect(documentoSchema.parse("123.456.789-09")).toBe("12345678909");
  });

  it("aceita CNPJ formatado", () => {
    expect(documentoSchema.parse("12.345.678/0001-90")).toBe("12345678000190");
  });

  it("aceita vazio — o documento só é exigido na emissão da nota", () => {
    expect(documentoSchema.parse("")).toBe("");
  });

  it("recusa quantidade de dígitos que não é CPF nem CNPJ", () => {
    expect(() => documentoSchema.parse("123456")).toThrow();
  });
});
