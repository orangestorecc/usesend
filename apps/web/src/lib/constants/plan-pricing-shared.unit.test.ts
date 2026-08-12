import { describe, expect, it } from "vitest";

import {
  estadoDoCard,
  PASSOS_MARKETING,
  PASSOS_TRANSACIONAL,
  precoNoPasso,
} from "@usesend/lib/src/pricing";

/**
 * A matriz inteira das seções 2 e 3 de docs-spec/PLANOS-SPEC.md, passo a
 * passo. É dinheiro visível para o cliente — já pegamos um bug de dinheiro
 * neste projeto com o parser de juros, e o jeito de não repetir é conferir
 * cada célula.
 */

describe("transacional — preço por passo", () => {
  const esperado: [number, number, number][] = [
    // [passo, preço do Pro, preço do Scale]
    [0, 100, 450],
    [1, 100, 450],
    [2, 175, 450],
    [3, 175, 800],
    [4, 175, 1750],
    [5, 175, 3250],
    [6, 175, 4125],
    [7, 175, 5750],
    [8, 175, 5750],
  ];

  it.each(esperado)(
    "passo %i: Pro R$ %i e Scale R$ %i",
    (passo, pro, scale) => {
      expect(precoNoPasso("pro", passo)?.precoBRL).toBe(pro);
      expect(precoNoPasso("scale", passo)?.precoBRL).toBe(scale);
    },
  );

  it("o Pro congela no teto depois de 100 mil", () => {
    expect(precoNoPasso("pro", 8)?.volume).toBe("100.000 e-mails / mês");
  });

  it("o excedente do Scale cai conforme o volume sobe", () => {
    expect(precoNoPasso("scale", 2)?.extra).toContain("4,50");
    expect(precoNoPasso("scale", 3)?.extra).toContain("4,00");
    expect(precoNoPasso("scale", 4)?.extra).toContain("3,50");
    expect(precoNoPasso("scale", 5)?.extra).toContain("3,25");
    expect(precoNoPasso("scale", 6)?.extra).toContain("2,60");
    expect(precoNoPasso("scale", 7)?.extra).toContain("2,30");
  });

  it("o excedente do Pro não muda", () => {
    expect(precoNoPasso("pro", 0)?.extra).toContain("4,50");
    expect(precoNoPasso("pro", 8)?.extra).toContain("4,50");
  });
});

describe("marketing — preço por passo", () => {
  const esperado: [number, number][] = [
    [0, 200],
    [1, 200],
    [2, 400],
    [3, 900],
    [4, 1250],
    [5, 2250],
    [6, 3250],
    [7, 3250],
  ];

  it.each(esperado)("passo %i: Pro marketing R$ %i", (passo, preco) => {
    expect(precoNoPasso("pro_marketing", passo)?.precoBRL).toBe(preco);
  });
});

describe("todo preço é o do Resend vezes 5", () => {
  it("transacional", () => {
    const emDolar = [20, 35, 90, 160, 350, 650, 825, 1150];
    const emReais = [100, 175, 450, 800, 1750, 3250, 4125, 5750];
    emDolar.forEach((d, i) => expect(d * 5).toBe(emReais[i]));
  });

  it("marketing", () => {
    const emDolar = [40, 80, 180, 250, 450, 650];
    const emReais = [200, 400, 900, 1250, 2250, 3250];
    emDolar.forEach((d, i) => expect(d * 5).toBe(emReais[i]));
  });
});

describe("quem fica recomendado", () => {
  function recomendadoNoPasso(passo: number): string[] {
    return ["free", "pro", "scale", "enterprise"].filter(
      (k) => estadoDoCard("transactional", k, passo, 0, "x").recomendado,
    );
  }

  it("no primeiro passo ninguém leva badge", () => {
    expect(recomendadoNoPasso(0)).toEqual([]);
  });

  it("50 mil recomenda o Pro", () => {
    expect(recomendadoNoPasso(1)).toEqual(["pro"]);
  });

  it("100 mil recomenda o Pro, que é o mais barato que atende", () => {
    expect(recomendadoNoPasso(2)).toEqual(["pro"]);
  });

  it("de 200 mil para cima recomenda o Scale", () => {
    expect(recomendadoNoPasso(3)).toEqual(["scale"]);
    expect(recomendadoNoPasso(7)).toEqual(["scale"]);
  });

  it("no último passo recomenda o Enterprise", () => {
    expect(recomendadoNoPasso(PASSOS_TRANSACIONAL.length - 1)).toEqual([
      "enterprise",
    ]);
  });

  it("marketing recomenda o Pro marketing no meio e Enterprise no fim", () => {
    const rec = (passo: number) =>
      ["free", "pro_marketing", "enterprise"].filter(
        (k) => estadoDoCard("marketing", k, passo, 0, "x").recomendado,
      );
    expect(rec(0)).toEqual([]);
    expect(rec(3)).toEqual(["pro_marketing"]);
    expect(rec(PASSOS_MARKETING.length - 1)).toEqual(["enterprise"]);
  });
});

describe("quem fica esmaecido", () => {
  function acesosNoPasso(passo: number): string[] {
    return ["free", "pro", "scale", "enterprise"].filter(
      (k) => !estadoDoCard("transactional", k, passo, 0, "x").esmaecido,
    );
  }

  it("no primeiro passo nada é esmaecido", () => {
    expect(acesosNoPasso(0)).toHaveLength(4);
  });

  it("em 100 mil os dois cards do meio ficam acesos", () => {
    expect(acesosNoPasso(2)).toEqual(["pro", "scale"]);
  });

  it("em 50 mil só o Pro fica aceso", () => {
    expect(acesosNoPasso(1)).toEqual(["pro"]);
  });

  it("em 500 mil só o Scale fica aceso", () => {
    expect(acesosNoPasso(4)).toEqual(["scale"]);
  });

  it("no último passo só o Enterprise fica aceso", () => {
    expect(acesosNoPasso(PASSOS_TRANSACIONAL.length - 1)).toEqual([
      "enterprise",
    ]);
  });
});

describe("planos de preço fixo", () => {
  it("Free e Enterprise não mudam com o slider", () => {
    for (let passo = 0; passo < PASSOS_TRANSACIONAL.length; passo++) {
      const free = estadoDoCard(
        "transactional",
        "free",
        passo,
        0,
        "3.000 e-mails / mês",
      );
      expect(free.precoBRL).toBe(0);
      expect(free.volume).toBe("3.000 e-mails / mês");

      const ent = estadoDoCard(
        "transactional",
        "enterprise",
        passo,
        null,
        "sob medida",
      );
      expect(ent.precoBRL).toBeNull();
    }
  });
});
