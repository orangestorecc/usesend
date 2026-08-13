import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockConsumir, mockEmitir, mockMailer } = vi.hoisted(() => {
  const tx = {
    user: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    emailChangeRequest: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    account: { findMany: vi.fn(), deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    userAuditLog: { create: vi.fn() },
  };
  return {
    mockDb: {
      ...tx,
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      __tx: tx,
    },
    mockConsumir: vi.fn(),
    mockEmitir: vi.fn(),
    mockMailer: {
      enviarCodigoDeSeguranca: vi.fn(),
      enviarAvisoDeTrocaDeEmail: vi.fn(),
      enviarAvisoDeMfa: vi.fn(),
    },
  };
});

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/env", () => ({ env: { NEXTAUTH_URL: "https://app.madmail.com.br" } }));
vi.mock("~/server/service/security-code-service", () => ({
  consumirCodigo: mockConsumir,
  emitirCodigo: mockEmitir,
}));
vi.mock("~/server/service/security-mailer", () => mockMailer);

import {
  confirmarTrocaDeEmail,
  reverterTrocaDeEmail,
  urlDeReversao,
} from "~/server/service/email-change-service";

const tx = (mockDb as any).__tx;

describe("urlDeReversao", () => {
  it("aponta para fora do dashboard — a reversão derruba todas as sessões", () => {
    expect(urlDeReversao("abc")).toBe(
      "https://app.madmail.com.br/reverter-email?token=abc",
    );
  });
});

describe("confirmarTrocaDeEmail", () => {
  beforeEach(() => {
    mockConsumir.mockResolvedValue({ ok: true });
    tx.account.findMany.mockResolvedValue([
      { provider: "google", providerAccountId: "g1" },
    ]);
    tx.emailChangeRequest.findFirst.mockResolvedValue({
      id: "ecr_1",
      userId: 1,
      oldEmail: "antigo@x.com",
      newEmail: "novo@x.com",
      revertToken: "tok",
    });
    mockDb.emailChangeRequest.findFirst = tx.emailChangeRequest.findFirst;
  });

  it("recusa código inválido sem trocar nada", async () => {
    mockConsumir.mockResolvedValue({ ok: false, motivo: "incorreto" });

    await expect(
      confirmarTrocaDeEmail(1, "zzzzz", {}),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("preserva a sessão atual ao derrubar as outras", async () => {
    await confirmarTrocaDeEmail(1, "ab12c", { sessionToken: "atual" });

    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, sessionToken: { not: "atual" } },
    });
  });

  it("guarda o snapshot das contas OAuth para a reversão", async () => {
    await confirmarTrocaDeEmail(1, "ab12c", { sessionToken: "atual" });

    const dados = tx.emailChangeRequest.update.mock.calls.at(-1)![0].data;
    expect(dados.oauthAccountsSnapshot).toEqual([
      { provider: "google", providerAccountId: "g1" },
    ]);
    expect(dados.revertDeadline).toBeInstanceOf(Date);
  });

  it("avisa o e-mail antigo com o link de reversão", async () => {
    await confirmarTrocaDeEmail(1, "ab12c", {});

    expect(mockMailer.enviarAvisoDeTrocaDeEmail).toHaveBeenCalledWith(
      "antigo@x.com",
      "novo@x.com",
      "https://app.madmail.com.br/reverter-email?token=tok",
      expect.any(Date),
    );
  });
});

describe("reverterTrocaDeEmail", () => {
  function pedido(over: Record<string, unknown> = {}) {
    return {
      id: "ecr_1",
      userId: 1,
      oldEmail: "antigo@x.com",
      newEmail: "novo@x.com",
      committedAt: new Date(),
      revertedAt: null,
      revertDeadline: new Date(Date.now() + 60_000),
      oauthAccountsSnapshot: [{ provider: "google", providerAccountId: "g1" }],
      ...over,
    };
  }

  beforeEach(() => {
    tx.account.findMany.mockResolvedValue([
      { id: "a1", provider: "google", providerAccountId: "g1" },
      { id: "a2", provider: "github", providerAccountId: "h9" },
    ]);
    mockDb.emailChangeRequest.findUnique = tx.emailChangeRequest.findUnique;
  });

  it("recusa token expirado", async () => {
    tx.emailChangeRequest.findUnique.mockResolvedValue(
      pedido({ revertDeadline: new Date(Date.now() - 1000) }),
    );

    await expect(reverterTrocaDeEmail("tok")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("recusa token já usado", async () => {
    tx.emailChangeRequest.findUnique.mockResolvedValue(
      pedido({ revertedAt: new Date() }),
    );

    await expect(reverterTrocaDeEmail("tok")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("remove só as contas OAuth vinculadas depois da troca", async () => {
    tx.emailChangeRequest.findUnique.mockResolvedValue(pedido());

    await reverterTrocaDeEmail("tok");

    expect(tx.account.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["a2"] } },
    });
  });

  it("derruba todas as sessões, sem exceção", async () => {
    tx.emailChangeRequest.findUnique.mockResolvedValue(pedido());

    await reverterTrocaDeEmail("tok");

    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1 },
    });
  });
});
