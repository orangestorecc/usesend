import { describe, expect, it } from "vitest";

import {
  analisarArquivo,
  aplicarMapeamento,
  detectarSeparador,
  dividirLinha,
  mapearAutomaticamente,
} from "./parse";

describe("dividirLinha", () => {
  it("respeita aspas com separador dentro", () => {
    expect(dividirLinha('a,"b,c",d', ",")).toEqual(["a", "b,c", "d"]);
  });

  it("entende aspas escapadas", () => {
    expect(dividirLinha('"disse ""oi""",x', ",")).toEqual(['disse "oi"', "x"]);
  });
});

describe("detectarSeparador", () => {
  it("escolhe ponto e vírgula quando ele domina", () => {
    expect(detectarSeparador("email;nome;cidade")).toBe(";");
  });

  it("escolhe vírgula no padrão internacional", () => {
    expect(detectarSeparador("email,nome,cidade")).toBe(",");
  });
});

describe("analisarArquivo", () => {
  it("remove o BOM que o Excel grava", () => {
    const a = analisarArquivo("﻿email;nome\njoao@x.com.br;João");
    expect(a.cabecalhos[0]).toBe("email");
  });

  it("trata a primeira linha como dado quando ela já tem e-mail", () => {
    const a = analisarArquivo("joao@x.com.br,João\nmaria@x.com.br,Maria");
    expect(a.semCabecalho).toBe(true);
    expect(a.linhas).toHaveLength(2);
    expect(a.cabecalhos).toEqual(["Coluna 1", "Coluna 2"]);
  });

  it("ignora linhas em branco", () => {
    const a = analisarArquivo("email\n\njoao@x.com.br\n\n");
    expect(a.linhas).toHaveLength(1);
  });
});

describe("mapearAutomaticamente", () => {
  it("reconhece cabeçalhos em português e inglês", () => {
    const m = mapearAutomaticamente([
      "E-mail",
      "Nome",
      "Sobrenome",
      "Inscrito",
    ]);
    expect(m["E-mail"]).toBe("email");
    expect(m["Nome"]).toBe("firstName");
    expect(m["Sobrenome"]).toBe("lastName");
    expect(m["Inscrito"]).toBe("subscribed");
  });

  it("ignora acento na comparação", () => {
    expect(mapearAutomaticamente(["ÚLTIMO NOME"])["ÚLTIMO NOME"]).toBe(
      "lastName",
    );
  });

  it("manda coluna desconhecida para propriedade", () => {
    expect(mapearAutomaticamente(["Cidade"])["Cidade"]).toBe("prop:Cidade");
  });

  it("não marca duas colunas como e-mail", () => {
    const m = mapearAutomaticamente(["email", "e-mail"]);
    const quantos = Object.values(m).filter((d) => d === "email").length;
    expect(quantos).toBe(1);
  });
});

describe("aplicarMapeamento", () => {
  const arquivo = analisarArquivo(
    [
      "email;nome;cidade",
      "joao@x.com.br;João;Recife",
      "MARIA@X.COM.BR;Maria;Olinda",
      "joao@x.com.br;João de novo;Recife",
      "sem-arroba;Ninguém;Lugar",
      ";Vazio;Lugar",
    ].join("\n"),
  );
  const mapeamento = mapearAutomaticamente(arquivo.cabecalhos);

  it("conta válidos, inválidos e duplicados separadamente", () => {
    const r = aplicarMapeamento(arquivo, mapeamento);
    expect(r.validos).toBe(2);
    expect(r.duplicados).toBe(1);
    expect(r.invalidos).toBe(2);
  });

  it("normaliza o e-mail para minúsculas", () => {
    const r = aplicarMapeamento(arquivo, mapeamento);
    expect(r.contatos[1]?.email).toBe("maria@x.com.br");
  });

  it("leva colunas extras para properties", () => {
    const r = aplicarMapeamento(arquivo, mapeamento);
    expect(r.contatos[0]?.properties).toEqual({ cidade: "Recife" });
  });

  it("respeita a troca manual do de-para", () => {
    // A pessoa decidiu que "cidade" é o sobrenome. Absurdo, mas é a escolha
    // dela — o mapeamento manual tem que vencer o automático.
    const r = aplicarMapeamento(arquivo, {
      ...mapeamento,
      cidade: "lastName",
    });
    expect(r.contatos[0]?.lastName).toBe("Recife");
    expect(r.contatos[0]?.properties).toBeUndefined();
  });

  it("entende sim/não e yes/no na coluna de inscrito", () => {
    const a = analisarArquivo(
      ["email;inscrito", "a@x.com.br;sim", "b@x.com.br;nao", "c@x.com.br;yes"].join(
        "\n",
      ),
    );
    const r = aplicarMapeamento(a, mapearAutomaticamente(a.cabecalhos));
    expect(r.contatos[0]?.subscribed).toBe(true);
    expect(r.contatos[1]?.subscribed).toBe(false);
    expect(r.contatos[2]?.subscribed).toBe(true);
  });

  it("não inventa inscrito quando a coluna não existe", () => {
    const r = aplicarMapeamento(arquivo, mapeamento);
    expect(r.contatos[0]?.subscribed).toBeUndefined();
  });

  it("sem coluna de e-mail, nada é importado", () => {
    const r = aplicarMapeamento(arquivo, {
      email: "ignore",
      nome: "firstName",
      cidade: "ignore",
    });
    expect(r.validos).toBe(0);
  });
});
