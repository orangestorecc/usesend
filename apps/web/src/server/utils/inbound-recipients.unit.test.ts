import { describe, expect, it } from "vitest";
import { extrairDestinatariosDeEnvelope } from "./inbound-recipients";

describe("extrairDestinatariosDeEnvelope", () => {
  it("pega o destinatário carimbado pelo SES", () => {
    expect(
      extrairDestinatariosDeEnvelope(
        "by inbound-smtp.us-east-1.amazonaws.com id abc for contato@empresa.com.br; Wed, 13 Aug 2026 12:00:00 +0000",
      ),
    ).toEqual(["contato@empresa.com.br"]);
  });

  it("aceita o endereço entre sinais de menor/maior", () => {
    expect(
      extrairDestinatariosDeEnvelope("by mail id 1 for <Contato@Empresa.com.br>"),
    ).toEqual(["contato@empresa.com.br"]);
  });

  it("lê todos os saltos quando o header vem repetido", () => {
    expect(
      extrairDestinatariosDeEnvelope([
        "by a for um@empresa.com.br",
        "by b for dois@empresa.com.br",
      ]),
    ).toEqual(["um@empresa.com.br", "dois@empresa.com.br"]);
  });

  it("devolve vazio quando não há carimbo de envelope", () => {
    expect(extrairDestinatariosDeEnvelope("by mail id 1; Wed")).toEqual([]);
    expect(extrairDestinatariosDeEnvelope(undefined)).toEqual([]);
  });
});
