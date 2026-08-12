import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * O que estes testes travam é a garantia que o cliente pediu: a importação de
 * plataforma **não pode** disparar e-mail para contatos quando a lista está
 * com double opt-in desligado. A simulação usa o mesmo `addOrUpdateContact` da
 * sincronização real, então o teste vale para os dois caminhos.
 */

const mockAddOrUpdateContact = vi.fn();
const mockCreateContactBook = vi.fn();
const mockFetchCustomersPage = vi.fn();
const mockDb = {
  contactBook: { update: vi.fn() },
  email: { findFirst: vi.fn() },
  domain: { findFirst: vi.fn() },
};

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("../contact-service", () => ({
  addOrUpdateContact: (...args: unknown[]) => mockAddOrUpdateContact(...args),
}));
vi.mock("../contact-book-service", () => ({
  createContactBook: (...args: unknown[]) => mockCreateContactBook(...args),
}));
vi.mock("./orangestore", async () => {
  const real = await vi.importActual<typeof import("./orangestore")>(
    "./orangestore",
  );
  return {
    ...real,
    fetchCustomersPage: (...args: unknown[]) => mockFetchCustomersPage(...args),
  };
});

const { runTestImport } = await import("./test-import");

const CLIENTE = {
  email: "cliente@loja.com.br",
  firstname: "Maria",
  lastname: "Souza",
  telephone: "11999998888",
  newsletter: "1",
};

const OPTS = {
  teamId: 1,
  baseUrl: "https://loja.exemplo.com.br",
  apiKey: "chave",
  destinationEmail: "eu@minhaempresa.com.br",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateContactBook.mockResolvedValue({ id: "book_1", name: "[Teste]" });
  mockFetchCustomersPage.mockResolvedValue([CLIENTE]);
  mockAddOrUpdateContact.mockResolvedValue({
    id: "contact_1",
    email: OPTS.destinationEmail,
    subscribed: true,
  });
  mockDb.email.findFirst.mockResolvedValue(null);
});

describe("runTestImport", () => {
  it("não liga double opt-in na lista quando o usuário deixou desligado", async () => {
    const r = await runTestImport({
      ...OPTS,
      subscribeMode: "all",
      doubleOptInEnabled: false,
    });

    expect(mockDb.contactBook.update).not.toHaveBeenCalled();
    expect(r.email).toBeNull();
    expect(r.veredito).toContain("nenhum e-mail foi gerado");
    expect(r.veredito).not.toContain("ATENÇÃO");
  });

  it("denuncia em alto e bom som se sair e-mail com double opt-in desligado", async () => {
    mockDb.email.findFirst.mockResolvedValue({
      id: "email_1",
      subject: "Confirme sua inscrição",
      to: [OPTS.destinationEmail],
      latestStatus: "QUEUED",
    });

    const r = await runTestImport({
      ...OPTS,
      subscribeMode: "all",
      doubleOptInEnabled: false,
    });

    expect(r.veredito).toContain("ATENÇÃO");
  });

  it("liga double opt-in na lista e reporta o e-mail gerado", async () => {
    mockDb.email.findFirst.mockResolvedValue({
      id: "email_1",
      subject: "Confirme sua inscrição",
      to: [OPTS.destinationEmail],
      latestStatus: "QUEUED",
    });

    const r = await runTestImport({
      ...OPTS,
      subscribeMode: "all",
      doubleOptInEnabled: true,
    });

    expect(mockDb.contactBook.update).toHaveBeenCalledWith({
      where: { id: "book_1" },
      data: { doubleOptInEnabled: true },
    });
    expect(r.email?.id).toBe("email_1");
    expect(r.veredito).toContain("como esperado");
  });

  it("importa com o e-mail de teste, nunca com o e-mail do cliente da loja", async () => {
    await runTestImport({
      ...OPTS,
      subscribeMode: "all",
      doubleOptInEnabled: true,
    });

    const [, contato] = mockAddOrUpdateContact.mock.calls[0] ?? [];
    expect(contato.email).toBe(OPTS.destinationEmail);
    expect(contato.firstName).toBe("Maria");
  });

  it("explica a ausência de e-mail quando a loja não marcou newsletter", async () => {
    mockFetchCustomersPage.mockResolvedValue([
      { ...CLIENTE, newsletter: "0" },
    ]);

    const r = await runTestImport({
      ...OPTS,
      subscribeMode: "newsletter",
      doubleOptInEnabled: true,
    });

    expect(r.veredito).toContain("não tem newsletter marcada");
    expect(r.veredito).not.toContain("ATENÇÃO");
  });

  it("avisa quando a loja não devolve cliente nenhum", async () => {
    mockFetchCustomersPage.mockResolvedValue([]);

    const r = await runTestImport({
      ...OPTS,
      subscribeMode: "all",
      doubleOptInEnabled: false,
    });

    expect(r.contato).toBeNull();
    expect(r.veredito).toContain("sem nenhum cliente");
  });
});
