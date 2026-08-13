import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockMail } = vi.hoisted(() => {
  const tx = {
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    mfaResetRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    mfaRecoveryCode: { deleteMany: vi.fn() },
    userAuditLog: { create: vi.fn() },
  };
  return {
    mockDb: { ...tx, $transaction: vi.fn(async (fn: any) => fn(tx)), __tx: tx },
    mockMail: vi.fn(),
  };
});

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/env", () => ({
  env: { NEXTAUTH_URL: "https://app.madmail.com.br", FROM_EMAIL: "x@y.com" },
}));
vi.mock("~/server/mailer", () => ({ sendMail: mockMail }));

import {
  aprovarResetDeMfa,
  cancelarResetDeMfa,
  executarResetsVencidos,
  solicitarResetDeMfa,
} from "~/server/service/mfa-reset-service";

const tx = (mockDb as any).__tx;

describe("solicitarResetDeMfa", () => {
  beforeEach(() => {
    tx.user.findUniqueOrThrow.mockResolvedValue({
      email: "dono@x.com",
      subjectId: "sub_1",
      mfaEnabled: true,
    });
    tx.mfaResetRequest.findFirst.mockResolvedValue(null);
    mockDb.user.findUniqueOrThrow = tx.user.findUniqueOrThrow;
    mockDb.mfaResetRequest.findFirst = tx.mfaResetRequest.findFirst;
  });

  it("avisa o dono com link de cancelamento — ele é quem pode barrar", async () => {
    await solicitarResetDeMfa(1, "suporte1@madmail.com.br");

    expect(mockMail).toHaveBeenCalled();
    const texto = mockMail.mock.calls[0]![2] as string;
    expect(texto).toContain("/cancelar-reset-mfa?token=");
    expect(texto).toContain("72 horas");
  });

  it("agenda a execução para daqui a 72h, não para agora", async () => {
    await solicitarResetDeMfa(1, "suporte1@madmail.com.br");

    const { executesAt } = tx.mfaResetRequest.create.mock.calls[0]![0].data;
    const horas = (executesAt.getTime() - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(71);
    expect(horas).toBeLessThan(73);
  });

  it("recusa segundo pedido pendente para a mesma conta", async () => {
    tx.mfaResetRequest.findFirst.mockResolvedValue({ id: "req_1" });

    await expect(
      solicitarResetDeMfa(1, "suporte1@madmail.com.br"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("aprovarResetDeMfa", () => {
  beforeEach(() => {
    mockDb.mfaResetRequest.findUnique = tx.mfaResetRequest.findUnique;
  });

  it("recusa aprovação de quem pediu — two-person rule", async () => {
    tx.mfaResetRequest.findUnique.mockResolvedValue({
      id: "req_1",
      requestedBy: "Suporte1@madmail.com.br",
      canceledAt: null,
      executedAt: null,
    });

    await expect(
      aprovarResetDeMfa("req_1", "suporte1@madmail.com.br"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("aceita aprovação de outra pessoa", async () => {
    tx.mfaResetRequest.findUnique.mockResolvedValue({
      id: "req_1",
      requestedBy: "suporte1@madmail.com.br",
      canceledAt: null,
      executedAt: null,
    });

    await expect(
      aprovarResetDeMfa("req_1", "suporte2@madmail.com.br"),
    ).resolves.toBeUndefined();
  });
});

describe("executarResetsVencidos", () => {
  beforeEach(() => {
    mockDb.mfaResetRequest.findMany = tx.mfaResetRequest.findMany;
  });

  it("só pega pedidos aprovados, não cancelados e com prazo vencido", async () => {
    tx.mfaResetRequest.findMany.mockResolvedValue([]);

    await executarResetsVencidos();

    const where = tx.mfaResetRequest.findMany.mock.calls[0]![0].where;
    expect(where.canceledAt).toBeNull();
    expect(where.executedAt).toBeNull();
    expect(where.approvedBy).toEqual({ not: null });
    expect(where.executesAt).toHaveProperty("lte");
  });

  it("desliga o MFA e queima os recovery codes", async () => {
    tx.mfaResetRequest.findMany.mockResolvedValue([
      { id: "req_1", userId: 5, approvedBy: "s2@x.com", requestedBy: "s1@x.com" },
    ]);

    await executarResetsVencidos();

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { mfaEnabled: false, mfaEnabledAt: null },
    });
    expect(tx.mfaRecoveryCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: 5 },
    });
  });
});

describe("cancelarResetDeMfa", () => {
  it("recusa token de pedido já resolvido", async () => {
    mockDb.mfaResetRequest.findUnique = tx.mfaResetRequest.findUnique;
    tx.mfaResetRequest.findUnique.mockResolvedValue({
      id: "req_1",
      canceledAt: new Date(),
    });

    await expect(cancelarResetDeMfa("tok")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
