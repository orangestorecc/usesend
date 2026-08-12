import { describe, expect, it } from "vitest";

import {
  cepValido,
  cnpjValido,
  cpfValido,
  documentoValido,
  emailValido,
  formatarCep,
  formatarCnpj,
  formatarCpf,
  formatarDocumento,
  formatarTelefone,
  separarTelefone,
  telefoneParaArmazenar,
  telefoneValido,
  tipoDoDocumento,
} from "./validadores-br";

describe("CPF", () => {
  it("aceita CPF válido, com e sem máscara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(cpfValido("529.982.247-26")).toBe(false);
  });

  it("recusa repetidos, que passam na conta mas não existem", () => {
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
  });

  it("recusa tamanho errado", () => {
    expect(cpfValido("5299822472")).toBe(false);
  });

  it("formata progressivamente conforme digita", () => {
    expect(formatarCpf("529")).toBe("529");
    expect(formatarCpf("529982")).toBe("529.982");
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });

  it("ignora dígito a mais na máscara", () => {
    expect(formatarCpf("529982247259999")).toBe("529.982.247-25");
  });
});

describe("CNPJ", () => {
  it("aceita CNPJ válido", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
  });

  it("recusa repetidos", () => {
    expect(cnpjValido("11111111111111")).toBe(false);
  });

  it("formata progressivamente", () => {
    expect(formatarCnpj("11222")).toBe("11.222");
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("documento (CPF ou CNPJ no mesmo campo)", () => {
  it("reconhece o tipo pelo tamanho", () => {
    expect(tipoDoDocumento("52998224725")).toBe("cpf");
    expect(tipoDoDocumento("11222333000181")).toBe("cnpj");
    expect(tipoDoDocumento("123")).toBeNull();
  });

  it("valida conforme o tipo", () => {
    expect(documentoValido("529.982.247-25")).toBe(true);
    expect(documentoValido("11.222.333/0001-81")).toBe(true);
    expect(documentoValido("123456")).toBe(false);
  });

  it("troca a máscara ao passar de 11 dígitos", () => {
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("112223330001")).toBe("11.222.333/0001");
  });
});

describe("CEP", () => {
  it("exige oito dígitos", () => {
    expect(cepValido("50000-000")).toBe(true);
    expect(cepValido("5000000")).toBe(false);
  });

  it("formata com hífen", () => {
    expect(formatarCep("50000000")).toBe("50000-000");
    expect(formatarCep("500")).toBe("500");
  });
});

describe("e-mail", () => {
  it("aceita endereços comuns", () => {
    expect(emailValido("rafael@n49.com.br")).toBe(true);
    expect(emailValido("nome.sobrenome+tag@empresa.com")).toBe(true);
  });

  it("recusa sem arroba, sem domínio ou sem TLD", () => {
    expect(emailValido("rafael")).toBe(false);
    expect(emailValido("rafael@")).toBe(false);
    expect(emailValido("rafael@empresa")).toBe(false);
  });

  it("recusa ponto duplicado e espaço", () => {
    expect(emailValido("rafael@empresa..com")).toBe(false);
    expect(emailValido("ra fael@empresa.com")).toBe(false);
  });

  it("recusa vazio", () => {
    expect(emailValido("")).toBe(false);
    expect(emailValido("   ")).toBe(false);
  });
});

describe("telefone", () => {
  it("aceita celular e fixo brasileiros", () => {
    expect(telefoneValido("(81) 99999-8888", "BR")).toBe(true);
    expect(telefoneValido("(81) 3333-4444", "BR")).toBe(true);
  });

  it("recusa DDD inexistente", () => {
    expect(telefoneValido("(01) 99999-8888", "BR")).toBe(false);
  });

  it("recusa celular de 11 dígitos que não começa com 9", () => {
    expect(telefoneValido("81899998888", "BR")).toBe(false);
  });

  it("respeita o tamanho de outros países", () => {
    expect(telefoneValido("912345678", "PT")).toBe(true);
    expect(telefoneValido("91234567", "PT")).toBe(false);
  });

  it("formata como o brasileiro espera ler", () => {
    expect(formatarTelefone("81999998888", "BR")).toBe("(81) 99999-8888");
    expect(formatarTelefone("8133334444", "BR")).toBe("(81) 3333-4444");
    expect(formatarTelefone("81", "BR")).toBe("(81");
  });

  it("guarda com DDI e volta certo", () => {
    const guardado = telefoneParaArmazenar("(81) 99999-8888", "BR");
    expect(guardado).toBe("5581999998888");
    expect(separarTelefone(guardado)).toEqual({
      codigoPais: "BR",
      numero: "81999998888",
    });
  });

  it("não confunde DDI curto com o começo de um longo", () => {
    // 598 (Uruguai) não pode ser lido como 5 + resto, nem 55 roubar o dele.
    const uy = telefoneParaArmazenar("99123456", "UY");
    expect(uy).toBe("59899123456");
    expect(separarTelefone(uy).codigoPais).toBe("UY");
  });

  it("cai no Brasil quando não reconhece o formato guardado", () => {
    expect(separarTelefone("12345").codigoPais).toBe("BR");
  });
});
