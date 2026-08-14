import { describe, expect, it, vi } from "vitest";

/**
 * A conta que a modal de detalhe da fatura mostra:
 *
 *   subtotal - desconto + extras + juros = total
 *
 * Ela é gravada na cobrança e copiada para a fatura, nunca recalculada a
 * partir do catálogo — preço de plano e regra de cupom mudam com o tempo, e a
 * fatura de março tem que continuar explicando a conta de março. Se esta
 * igualdade quebrar, o cliente vê um total que não fecha com as linhas acima
 * dele, que é a única coisa pior do que não mostrar detalhe nenhum.
 */

vi.mock("~/server/db", () => ({ db: {} }));

const { montarMemoria } = await import("./payment-service");

const plano = {
  key: "pro_marketing",
  name: "Marketing Pro",
  priceBRL: 200,
} as Parameters<typeof montarMemoria>[0]["plan"];

/**
 * `toLocaleString("pt-BR")` separa "R$" do número com espaço não separável
 * (U+00A0) — é o certo tipograficamente, mas não se digita num literal.
 */
const semNbsp = (s: string | null) => s?.replace(/ /g, " ") ?? null;

/** O que a modal soma na tela. */
const totalNaTela = (m: ReturnType<typeof montarMemoria>, extras = 0) =>
  (m.subtotalCents ?? 0) - m.discountCents + extras + m.surchargeCents;

describe("memória de cálculo da fatura", () => {
  it("sem cupom, o subtotal é o próprio total", () => {
    const m = montarMemoria({
      plan: plano,
      product: "marketing",
      promo: null,
      amountCents: 20000,
      totalCents: 20000,
    });

    expect(m.subtotalCents).toBe(20000);
    expect(m.discountCents).toBe(0);
    expect(m.promoCode).toBeNull();
    expect(totalNaTela(m)).toBe(20000);
  });

  it("cupom percentual: guarda o desconto e o rótulo que o cliente viu", () => {
    const m = montarMemoria({
      plan: plano,
      product: "marketing",
      promo: {
        id: "p1",
        code: "LANC20",
        percentOff: 20,
        amountOffCents: null,
      },
      amountCents: 16000,
      totalCents: 16000,
    });

    expect(m.discountCents).toBe(4000);
    expect(m.promoCode).toBe("LANC20");
    expect(m.promoLabel).toBe("20% OFF");
    expect(totalNaTela(m)).toBe(16000);
  });

  it("cupom de valor fixo vira rótulo em reais", () => {
    const m = montarMemoria({
      plan: plano,
      product: "marketing",
      promo: {
        id: "p2",
        code: "AMIGO30",
        percentOff: null,
        amountOffCents: 3000,
      },
      amountCents: 17000,
      totalCents: 17000,
    });

    expect(m.discountCents).toBe(3000);
    expect(semNbsp(m.promoLabel)).toBe("R$ 30,00 OFF");
    expect(totalNaTela(m)).toBe(17000);
  });

  it("parcelamento com juros entra como acréscimo, não como preço do plano", () => {
    // O cliente parcelou em 3x com juros: o plano continua custando R$ 200 e a
    // diferença precisa aparecer como juros — senão parece aumento de preço.
    const m = montarMemoria({
      plan: plano,
      product: "marketing",
      promo: null,
      amountCents: 20000,
      totalCents: 20600,
      installments: 3,
    });

    expect(m.subtotalCents).toBe(20000);
    expect(m.surchargeCents).toBe(600);
    expect(m.installments).toBe(3);
    expect(totalNaTela(m)).toBe(20600);
  });

  it("cupom e juros juntos continuam fechando a conta", () => {
    const m = montarMemoria({
      plan: plano,
      product: "marketing",
      promo: {
        id: "p1",
        code: "LANC20",
        percentOff: 20,
        amountOffCents: null,
      },
      amountCents: 16000,
      totalCents: 16480,
      installments: 2,
    });

    expect(totalNaTela(m)).toBe(16480);
  });

  it("cupom que zera a fatura não vira desconto negativo", () => {
    // Cupom de 100%: o total é zero, mas o subtotal tem que continuar contando
    // a história de quanto o plano custava.
    const m = montarMemoria({
      plan: plano,
      product: "marketing",
      promo: {
        id: "p3",
        code: "CORTESIA",
        percentOff: 100,
        amountOffCents: null,
      },
      amountCents: 0,
      totalCents: 0,
    });

    expect(m.subtotalCents).toBe(20000);
    expect(m.discountCents).toBe(20000);
    expect(totalNaTela(m)).toBe(0);
  });

  it("carrega o passo do slider, que é quem define o preço na renovação", () => {
    // Sem o tier, a renovação resolveria o preço só pela chave do plano e
    // cobraria o degrau base.
    const m = montarMemoria({
      plan: { ...plano, priceBRL: 2250 },
      product: "marketing",
      promo: null,
      amountCents: 225000,
      totalCents: 225000,
      tier: 7,
    });

    expect(m.tier).toBe(7);
    expect(m.subtotalCents).toBe(225000);
  });
});
