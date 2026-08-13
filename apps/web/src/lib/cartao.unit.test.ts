import { describe, expect, it } from "vitest";

import {
  detectarBandeira,
  formatarNumeroCartao,
  formatarValidade,
  luhnValido,
  validarCartao,
  validarCvc,
  validarNumeroCartao,
  validarTitular,
  validarValidade,
} from "./cartao";

describe("máscara da validade", () => {
  it("põe a barra sozinha — 0332 vira 03/32", () => {
    // Foi o que quebrou o checkout em produção: o campo exigia "MM / AA" e
    // recusava quem digitava só os quatro números.
    expect(formatarValidade("0332")).toBe("03/32");
  });

  it("completa o zero do mês quando não há ambiguidade", () => {
    // Não existe mês começando em 3, então "3" só pode ser março.
    expect(formatarValidade("3")).toBe("03/");
    expect(formatarValidade("1")).toBe("1"); // pode virar 01, 10, 11 ou 12
  });

  it("ignora o que passa de quatro dígitos e o que não é número", () => {
    expect(formatarValidade("12/2599")).toBe("12/25");
    expect(formatarValidade("ab12cd25")).toBe("12/25");
  });
});

describe("validade", () => {
  const agora = new Date(2026, 7, 13); // 13/08/2026

  it("aceita cartão que ainda vale", () => {
    expect(validarValidade("03/32", agora)).toBeNull();
  });

  it("aceita até o último dia do mês de vencimento", () => {
    // Cartão "08/26" vale o mês de agosto inteiro, não vence no dia 1º.
    expect(validarValidade("08/26", agora)).toBeNull();
  });

  it("recusa vencido, mês inválido e incompleto", () => {
    expect(validarValidade("07/26", agora)).toBe("Cartão vencido.");
    expect(validarValidade("13/30", agora)).toBe("Mês inválido.");
    expect(validarValidade("03", agora)).toBe("Validade incompleta.");
  });
});

describe("número do cartão", () => {
  it("formata em grupos de 4", () => {
    expect(formatarNumeroCartao("5214331260204458")).toBe(
      "5214 3312 6020 4458",
    );
  });

  it("usa o agrupamento 4-6-5 do Amex", () => {
    expect(formatarNumeroCartao("378282246310005")).toBe("3782 822463 10005");
  });

  it("identifica a bandeira pelo prefixo", () => {
    expect(detectarBandeira("4111111111111111").nome).toBe("Visa");
    expect(detectarBandeira("5214331260204458").nome).toBe("Mastercard");
    expect(detectarBandeira("378282246310005").nome).toBe("American Express");
    // BIN do Elo que começa com 4 — cairia em Visa se a ordem não fosse
    // deliberada.
    expect(detectarBandeira("4011780000000000").nome).toBe("Elo");
  });

  it("valida o dígito verificador (Luhn)", () => {
    expect(luhnValido("4111111111111111")).toBe(true);
    expect(luhnValido("4111111111111112")).toBe(false);
  });

  it("recusa número incompleto antes de recusar por Luhn", () => {
    expect(validarNumeroCartao("4111 1111")).toMatch(/incompleto/i);
    expect(validarNumeroCartao("4111111111111112")).toBe(
      "Número de cartão inválido.",
    );
    expect(validarNumeroCartao("4111111111111111")).toBeNull();
  });
});

describe("código de segurança", () => {
  it("exige 4 dígitos no Amex e 3 nas demais", () => {
    expect(validarCvc("123", "378282246310005")).toMatch(/4 dígitos/);
    expect(validarCvc("1234", "378282246310005")).toBeNull();
    expect(validarCvc("964", "5214331260204458")).toBeNull();
  });
});

describe("titular", () => {
  it("exige nome e sobrenome", () => {
    // "Rafael Pes" (do relato) passa; só "Rafael" não — emissor recusa.
    expect(validarTitular("Rafael Pes")).toBeNull();
    expect(validarTitular("Rafael")).toMatch(/sobrenome/);
  });

  it("recusa dígitos e vazio", () => {
    expect(validarTitular("Rafael 123")).toMatch(/letras/);
    expect(validarTitular("  ")).toMatch(/Informe/);
  });

  it("aceita acento, hífen e apóstrofo", () => {
    expect(validarTitular("João D'Ávila-Silva")).toBeNull();
  });
});

describe("validação do formulário inteiro", () => {
  const agora = new Date(2026, 7, 13);

  it("aponta cada campo separadamente", () => {
    const erros = validarCartao(
      { numero: "4111", validade: "0320", cvc: "1", titular: "X" },
      agora,
    );
    expect(erros.numero).toBeTruthy();
    expect(erros.validade).toBeTruthy();
    expect(erros.cvc).toBeTruthy();
    expect(erros.titular).toBeTruthy();
  });

  it("não acusa nada quando está tudo certo", () => {
    const erros = validarCartao(
      {
        numero: "5214 3312 6020 4458",
        validade: "03/32",
        cvc: "964",
        titular: "Rafael Pes",
      },
      agora,
    );
    expect(Object.values(erros).every((e) => e === null)).toBe(true);
  });
});
