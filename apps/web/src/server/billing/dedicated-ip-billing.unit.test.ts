import { describe, expect, it } from "vitest";

import { mensalidadeIpDedicadoCents } from "./overage-service";

/**
 * Mensalidade do IP dedicado. É dinheiro e é proporcional, então o que importa
 * aqui é não cobrar antes de entregar nem entregar sem cobrar.
 *
 * Março de 2026 tem 31 dias — mês fixo de propósito, para o rateio não mudar
 * de resultado conforme o calendário.
 */
describe("mensalidadeIpDedicadoCents", () => {
  const emMarco = (dia: number) => new Date(2026, 2, dia);
  const agora = emMarco(31);

  it("não cobra nada enquanto o IP não entrou em operação", () => {
    expect(mensalidadeIpDedicadoCents(null, null, agora).cents).toBe(0);
  });

  it("cobra o mês cheio quando o IP operou o mês inteiro", () => {
    const r = mensalidadeIpDedicadoCents(new Date(2026, 0, 10), null, agora);
    expect(r.cents).toBe(15000);
    expect(r.dias).toBe(31);
  });

  it("não retroage: ativar no fim do mês cobra só os dias servidos", () => {
    // Ativo em 21/03 → 11 dias (21..31) de 31.
    const r = mensalidadeIpDedicadoCents(emMarco(21), null, agora);
    expect(r.dias).toBe(11);
    expect(r.cents).toBe(Math.round((15000 * 11) / 31));
    expect(r.cents).toBeLessThan(15000);
  });

  it("cancelar no meio do mês ainda cobra os dias já entregues", () => {
    // Antes, cancelar zerava o `activeAt` e o mês inteiro saía de graça.
    const r = mensalidadeIpDedicadoCents(
      new Date(2026, 0, 10),
      emMarco(21),
      agora,
    );
    expect(r.dias).toBe(20);
    expect(r.cents).toBeGreaterThan(0);
    expect(r.cents).toBeLessThan(15000);
  });

  it("zera sozinho no mês seguinte ao cancelamento, sem job de limpeza", () => {
    const r = mensalidadeIpDedicadoCents(
      new Date(2026, 0, 10),
      new Date(2026, 1, 15),
      agora,
    );
    expect(r.cents).toBe(0);
  });

  it("nunca cobra mais que a mensalidade cheia", () => {
    const r = mensalidadeIpDedicadoCents(
      new Date(2020, 0, 1),
      new Date(2030, 0, 1),
      agora,
    );
    expect(r.cents).toBe(15000);
  });

  it("um dia parcial conta como dia cheio, igual ao bloco de 1.000 e-mails", () => {
    const r = mensalidadeIpDedicadoCents(
      new Date(2026, 2, 31, 22, 0, 0),
      null,
      agora,
    );
    expect(r.dias).toBe(1);
    expect(r.cents).toBe(Math.round(15000 / 31));
  });
});
