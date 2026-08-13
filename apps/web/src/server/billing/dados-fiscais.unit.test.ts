import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `BillingContact` é a fonte única dos dados fiscais: é o que o checkout grava
 * e o que Configurações > Faturamento passou a ler e escrever. Antes havia uma
 * segunda tabela (`BillingProfile`) que o boleto lia sozinha, então quem
 * preenchia no checkout era recusado com os dados visíveis na tela logo acima
 * do botão. Os cadastros antigos foram migrados para cá.
 */

const billingContact = { findUnique: vi.fn() };

vi.mock("~/server/db", () => ({
  db: {
    billingContact: { findUnique: (...a: unknown[]) => billingContact.findUnique(...a) },
  },
}));

const { dadosFiscaisDoPagador } = await import("./payment-service");

beforeEach(() => {
  billingContact.findUnique.mockResolvedValue(null);
});

describe("dados fiscais do pagador", () => {
  it("usa o responsável financeiro preenchido no checkout", async () => {
    billingContact.findUnique.mockResolvedValue({
      responsavel: "Rafael Pinto e Silva",
      razaoSocial: "Rafael Pinto e Silva",
      documento: "96400242015",
      cep: "90000000",
      logradouro: "Av. Ipiranga",
      numero: "100",
      cidade: "Porto Alegre",
      uf: "RS",
    });

    const dados = await dadosFiscaisDoPagador(1);

    expect(dados.name).toBe("Rafael Pinto e Silva");
    expect(dados.document).toBe("96400242015");
    expect(dados.city).toBe("Porto Alegre");
    expect(dados.addressLine1).toBe("Av. Ipiranga, 100");
  });

  it("deriva PF/PJ do documento, não do default do cadastro", async () => {
    // O `personType` é "PJ" por default. Quem cadastrou um CPF sem corrigir o
    // tipo teria o boleto emitido como pessoa jurídica.
    billingContact.findUnique.mockResolvedValue({
      responsavel: "Rafael",
      documento: "964.002.420-15", // CPF, com máscara
    });

    expect((await dadosFiscaisDoPagador(1)).personType).toBe("PF");

    billingContact.findUnique.mockResolvedValue({
      responsavel: "N49",
      documento: "11222333000181", // CNPJ
    });

    expect((await dadosFiscaisDoPagador(1)).personType).toBe("PJ");
  });

  it("usa personType quando o documento não decide sozinho", async () => {
    // Cadastro antigo migrado do BillingProfile, ainda sem documento.
    billingContact.findUnique.mockResolvedValue({
      responsavel: "Fulano",
      razaoSocial: "Empresa Antiga LTDA",
      documento: null,
      personType: "PF",
      cidade: "São Paulo",
      uf: "SP",
    });

    const dados = await dadosFiscaisDoPagador(1);

    expect(dados.name).toBe("Empresa Antiga LTDA");
    expect(dados.city).toBe("São Paulo");
    expect(dados.personType).toBe("PF");
  });

  it("sem cadastro nenhum, devolve vazio para o checkout recusar", async () => {
    const dados = await dadosFiscaisDoPagador(1);

    expect(dados.name).toBeNull();
    expect(dados.document).toBeNull();
  });
});
