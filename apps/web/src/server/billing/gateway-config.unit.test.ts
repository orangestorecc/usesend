import { describe, expect, it } from "vitest";
import {
  calcularParcela,
  parseInstallmentRates,
  parseInstallments,
  serializeInstallmentRates,
} from "./gateway-config";

describe("parcelas habilitadas", () => {
  it("sempre inclui 1x, mesmo se não estiver na lista", () => {
    expect(parseInstallments("3,6")).toEqual([1, 3, 6]);
  });

  it("sem configuração, só à vista", () => {
    expect(parseInstallments(undefined)).toEqual([1]);
    expect(parseInstallments("")).toEqual([1]);
  });

  it("descarta valores fora da faixa e lixo", () => {
    expect(parseInstallments("0,2,13,abc,5")).toEqual([1, 2, 5]);
  });
});

describe("taxas de juros", () => {
  it("lê o formato parcelas:taxa", () => {
    expect(parseInstallmentRates("2:1.99;3:2.5")).toEqual({
      2: 1.99,
      3: 2.5,
    });
  });

  it("aceita vírgula decimal, como se digita em pt-BR", () => {
    expect(parseInstallmentRates("2:1,99")).toEqual({ 2: 1.99 });
  });

  it("ignora 1x e taxas inválidas", () => {
    expect(parseInstallmentRates("1:5;2:0;3:-1;4:abc")).toEqual({});
  });

  it("ida e volta preserva os valores", () => {
    const original = "2:1.99;6:2.5";
    expect(serializeInstallmentRates(parseInstallmentRates(original))).toBe(
      original,
    );
  });
});

describe("cálculo da parcela", () => {
  it("sem juros, divide o total", () => {
    const o = calcularParcela(30000, 3, 0);
    expect(o.valorParcelaCents).toBe(10000);
    expect(o.totalCents).toBe(30000);
    expect(o.semJuros).toBe(true);
  });

  it("à vista nunca tem juros, mesmo com taxa configurada", () => {
    const o = calcularParcela(10000, 1, 5);
    expect(o.totalCents).toBe(10000);
    expect(o.semJuros).toBe(true);
  });

  it("com juros, o total é maior que o valor à vista", () => {
    const o = calcularParcela(30000, 3, 1.99);
    expect(o.semJuros).toBe(false);
    expect(o.totalCents).toBeGreaterThan(30000);
    // Tabela Price: R$ 300 em 3x a 1,99% a.m. dá ~R$ 104,01 por parcela.
    expect(o.valorParcelaCents).toBe(10401);
    expect(o.totalCents).toBe(31203);
  });

  it("o total é sempre parcela x quantidade — o que o cliente vê fecha", () => {
    for (const n of [2, 3, 6, 12]) {
      const o = calcularParcela(19990, n, 1.99);
      expect(o.totalCents).toBe(o.valorParcelaCents * n);
    }
  });

  it("juros maiores encarecem mais", () => {
    const barato = calcularParcela(50000, 6, 1);
    const caro = calcularParcela(50000, 6, 3);
    expect(caro.totalCents).toBeGreaterThan(barato.totalCents);
  });
});
