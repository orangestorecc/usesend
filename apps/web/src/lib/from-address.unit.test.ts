import { describe, expect, it } from "vitest";

import {
  cabeNosCamposGuiados,
  compor,
  decompor,
  validarCaixa,
  validarNomeExibicao,
} from "./from-address";

describe("compor", () => {
  it("sem nome de exibição, devolve só o endereço", () => {
    expect(
      compor({ nomeExibicao: "", caixa: "contato", dominio: "loja.com.br" }),
    ).toBe("contato@loja.com.br");
  });

  it("com nome, monta no formato de cabeçalho", () => {
    expect(
      compor({
        nomeExibicao: "Loja do João",
        caixa: "contato",
        dominio: "loja.com.br",
      }),
    ).toBe("Loja do João <contato@loja.com.br>");
  });

  it("normaliza caixa e domínio para minúsculas", () => {
    expect(
      compor({ nomeExibicao: "", caixa: "CONTATO", dominio: "LOJA.COM.BR" }),
    ).toBe("contato@loja.com.br");
  });
});

describe("decompor", () => {
  it("quebra o formato com nome", () => {
    expect(decompor("Loja do João <contato@loja.com.br>")).toEqual({
      nomeExibicao: "Loja do João",
      caixa: "contato",
      dominio: "loja.com.br",
    });
  });

  it("quebra o endereço puro", () => {
    expect(decompor("contato@loja.com.br")).toEqual({
      nomeExibicao: "",
      caixa: "contato",
      dominio: "loja.com.br",
    });
  });

  it("tira aspas do nome de exibição", () => {
    expect(decompor('"Loja" <c@x.com.br>')?.nomeExibicao).toBe("Loja");
  });

  it("devolve null para lixo — foi o que o cliente digitou no print", () => {
    expect(decompor("rwerewrew")).toBeNull();
  });

  it("devolve null para vazio e nulo", () => {
    expect(decompor("")).toBeNull();
    expect(decompor(null)).toBeNull();
    expect(decompor(undefined)).toBeNull();
  });

  it("ida e volta preserva o valor", () => {
    const original = "Loja do João <contato@loja.com.br>";
    const partes = decompor(original)!;
    expect(compor(partes)).toBe(original);
  });
});

describe("cabeNosCamposGuiados", () => {
  it("aceita quando o domínio está entre os verificados", () => {
    expect(cabeNosCamposGuiados("c@loja.com.br", ["loja.com.br"])).toBe(true);
  });

  it("recusa quando o domínio saiu da lista", () => {
    // Domínio removido não pode sumir do formulário sem a pessoa ver.
    expect(cabeNosCamposGuiados("c@antigo.com.br", ["loja.com.br"])).toBe(
      false,
    );
  });

  it("recusa texto que não é endereço", () => {
    expect(cabeNosCamposGuiados("rwerewrew", ["loja.com.br"])).toBe(false);
  });
});

describe("validarCaixa", () => {
  it("reclama de vazio", () => {
    expect(validarCaixa("")).toContain("antes do @");
  });

  it("avisa quando a pessoa digitou o endereço inteiro", () => {
    expect(validarCaixa("contato@loja.com.br")).toContain("só o que vem antes");
  });

  it("recusa caractere inválido", () => {
    expect(validarCaixa("con tato")).toContain("apenas letras");
  });

  it("recusa ponto no começo ou no fim", () => {
    expect(validarCaixa(".contato")).toContain("ponto");
    expect(validarCaixa("contato.")).toContain("ponto");
  });

  it("aceita os caracteres do dia a dia", () => {
    expect(validarCaixa("nao-responda_2+tag.x")).toBeNull();
  });
});

describe("validarNomeExibicao", () => {
  it("recusa caracteres que quebrariam o cabeçalho", () => {
    expect(validarNomeExibicao("Loja <hack>")).toContain("< >");
    expect(validarNomeExibicao('Loja "x"')).toContain("< >");
  });

  it("aceita nome normal com acento", () => {
    expect(validarNomeExibicao("Loja do João")).toBeNull();
  });
});
