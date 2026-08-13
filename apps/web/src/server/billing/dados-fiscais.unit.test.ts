import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O time guarda dados fiscais em duas tabelas: `BillingContact`, preenchida no
 * próprio checkout, e `BillingProfile`, de Configurações > Faturamento. O
 * boleto lia só a segunda e recusava quem tinha preenchido a primeira — com os
 * dados visíveis na tela logo acima do botão.
 */

const billingContact = { findUnique: vi.fn() };
const billingProfile = { findUnique: vi.fn() };

vi.mock("~/server/db", () => ({
  db: {
    billingContact: { findUnique: (...a: unknown[]) => billingContact.findUnique(...a) },
    billingProfile: { findUnique: (...a: unknown[]) => billingProfile.findUnique(...a) },
  },
}));

const { dadosFiscaisDoPagador } = await import("./payment-service");

beforeEach(() => {
  billingContact.findUnique.mockResolvedValue(null);
  billingProfile.findUnique.mockResolvedValue(null);
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

  it("deriva PF/PJ do documento, não do default do profile", async () => {
    // O `personType` do profile é "PJ" por default. Quem preencheu só o
    // contato, com CPF, teria o boleto emitido como pessoa jurídica.
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

  it("cai para o profile quando o contato não existe", async () => {
    billingProfile.findUnique.mockResolvedValue({
      name: "Empresa Antiga LTDA",
      document: "11222333000181",
      personType: "PJ",
      city: "São Paulo",
      state: "SP",
      postalCode: "01000000",
      addressLine1: "Rua Antiga, 1",
    });

    const dados = await dadosFiscaisDoPagador(1);

    expect(dados.name).toBe("Empresa Antiga LTDA");
    expect(dados.city).toBe("São Paulo");
  });

  it("sem nenhuma das duas fontes, devolve vazio para o checkout recusar", async () => {
    const dados = await dadosFiscaisDoPagador(1);

    expect(dados.name).toBeNull();
    expect(dados.document).toBeNull();
  });
});
