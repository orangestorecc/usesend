import { describe, expect, it } from "vitest";

import {
  CATALOGO_MARKETING,
  CATALOGO_TRANSACIONAL,
  PASSOS_MARKETING,
  cotaMensalDoPlano,
  passoDoPlano,
  precoExcedenteBRL,
  precoNoPasso,
} from "@usesend/lib/src/pricing";

describe("passoDoPlano — sincronia do slider", () => {
  it("encosta o slider no volume que o plano entrega de fato", () => {
    // O bug relatado: Free em 1.000 contatos, card do Pro marketing mostrando
    // "5.000 contatos / R$ 200". O slider tem que ir para o degrau de 5.000.
    expect(PASSOS_MARKETING[0]).toBe("1.000");
    expect(passoDoPlano("marketing", "pro_marketing", 0)).toBe(
      PASSOS_MARKETING.indexOf("5.000"),
    );
  });

  it("leva o transacional do degrau 0 para os 50.000 do Pro", () => {
    expect(passoDoPlano("transactional", "pro", 0)).toBe(1);
  });

  it("nunca puxa o slider para trás", () => {
    // Em 500.000 o Pro não cresce mais (para em 100.000); o passo escolhido é
    // um piso de necessidade e não pode regredir só porque o card é menor.
    expect(passoDoPlano("transactional", "pro", 4)).toBe(4);
  });

  it("sincronizar o slider nunca muda o preço que o card prometeu", () => {
    // A garantia que torna a correção segura: o servidor recalcula o preço a
    // partir do passo, então se `passoDoPlano` levasse para um degrau de outra
    // faixa, o cliente confirmaria um valor e seria cobrado outro.
    const casos = [
      ["transactional", "pro"],
      ["transactional", "scale"],
      ["marketing", "pro_marketing"],
    ] as const;

    for (const [produto, plano] of casos) {
      for (let passo = 0; passo < 9; passo++) {
        const antes = precoNoPasso(plano, passo);
        const depois = precoNoPasso(plano, passoDoPlano(produto, plano, passo));
        expect(depois?.precoBRL, `${plano} no passo ${passo}`).toBe(
          antes?.precoBRL,
        );
        expect(depois?.volume).toBe(antes?.volume);
      }
    }
  });

  it("não mexe em plano sem faixa variável", () => {
    expect(passoDoPlano("transactional", "free", 3)).toBe(3);
    expect(passoDoPlano("transactional", "enterprise", 3)).toBe(3);
  });
});

describe("cotaMensalDoPlano", () => {
  it("lê a cota do próprio texto do volume", () => {
    expect(cotaMensalDoPlano("pro", 0)).toBe(50000);
    expect(cotaMensalDoPlano("pro", 2)).toBe(100000);
    expect(cotaMensalDoPlano("scale", 5)).toBe(1000000);
  });

  it("é nula para plano sem faixa variável — não há excedente a cobrar", () => {
    expect(cotaMensalDoPlano("free", 0)).toBeNull();
    expect(cotaMensalDoPlano("enterprise", 0)).toBeNull();
  });
});

describe("precoExcedenteBRL", () => {
  it("acompanha a faixa anunciada no /pricing, que cai com o volume", () => {
    expect(precoExcedenteBRL("pro", 0)).toBe(4.5);
    expect(precoExcedenteBRL("scale", 3)).toBe(4);
    expect(precoExcedenteBRL("scale", 4)).toBe(3.5);
    expect(precoExcedenteBRL("scale", 7)).toBe(2.3);
  });

  it("é nulo onde o plano não anuncia excedente", () => {
    expect(precoExcedenteBRL("pro_marketing", 0)).toBeNull();
    expect(precoExcedenteBRL("free", 0)).toBeNull();
  });
});

describe("catálogo compartilhado", () => {
  it("usa o mesmo preço-base que a matriz de preços cobra no passo 0", () => {
    // A divergência que motivou juntar as listas: o app anunciava Pro a R$ 20
    // enquanto o site e o checkout trabalhavam com R$ 100.
    for (const catalogo of [CATALOGO_TRANSACIONAL, CATALOGO_MARKETING]) {
      for (const plano of catalogo) {
        const faixa = precoNoPasso(plano.key, 0);
        if (!faixa) continue;
        expect(
          plano.priceBRL,
          `preço-base de ${plano.key} fora da matriz`,
        ).toBe(faixa.precoBRL);
      }
    }
  });

  it("mantém volume e excedente do card iguais aos da faixa base", () => {
    for (const catalogo of [CATALOGO_TRANSACIONAL, CATALOGO_MARKETING]) {
      for (const plano of catalogo) {
        const faixa = precoNoPasso(plano.key, 0);
        if (!faixa) continue;
        expect(plano.volume).toBe(faixa.volume);
        if (faixa.extra) expect(plano.extra).toBe(faixa.extra);
      }
    }
  });

  it("todo plano tem CTA nas duas vitrines", () => {
    for (const catalogo of [CATALOGO_TRANSACIONAL, CATALOGO_MARKETING]) {
      for (const plano of catalogo) {
        expect(plano.cta.length).toBeGreaterThan(0);
        expect(plano.ctaSite?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
