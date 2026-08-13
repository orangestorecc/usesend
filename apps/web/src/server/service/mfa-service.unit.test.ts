import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockRate, envMock } = vi.hoisted(() => {
  const tx = {
    session: { update: vi.fn(), findUnique: vi.fn() },
    mfaChallenge: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    mfaRecoveryCode: { findFirst: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
  };
  return {
    mockDb: { ...tx, $transaction: vi.fn(async (fn: any) => fn(tx)), __tx: tx },
    mockRate: { estaTravado: vi.fn(), registrarFalhaDeCodigo: vi.fn() },
    envMock: { env: { MFA_ENABLED: "true" } },
  };
});

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/env", () => envMock);
vi.mock("~/server/service/rate-limit-service", () => mockRate);
vi.mock("~/server/service/security-mailer", () => ({
  enviarCodigoDeSeguranca: vi.fn(),
  enviarAvisoDeMfa: vi.fn(),
}));
vi.mock("~/server/service/security-code-service", async () => {
  const { createHmac } = await import("crypto");
  return {
    hmacDoCodigo: (c: string) =>
      createHmac("sha256", "p").update(c.trim().toLowerCase()).digest("hex"),
    gerarCodigo: () => "ab12c",
    emitirCodigo: vi.fn(async () => "ab12c"),
    consumirCodigo: vi.fn(async () => ({ ok: true })),
    MAX_TENTATIVAS: 5,
  };
});

import { avaliarGate, verificarDesafio } from "~/server/service/mfa-service";
import { hmacDoCodigo } from "~/server/service/security-code-service";

const tx = (mockDb as any).__tx;

describe("avaliarGate", () => {
  beforeEach(() => {
    envMock.env.MFA_ENABLED = "true";
    mockDb.session.findUnique = tx.session.findUnique;
  });

  it("bloqueia quando não há token — fail-closed", async () => {
    await expect(avaliarGate(null)).resolves.toEqual({
      liberado: false,
      motivo: "mfa_pendente",
    });
  });

  it("bloqueia sessão inexistente em vez de liberar por omissão", async () => {
    tx.session.findUnique.mockResolvedValue(null);

    await expect(avaliarGate("tok")).resolves.toEqual({
      liberado: false,
      motivo: "mfa_pendente",
    });
  });

  it("bloqueia conta excluída", async () => {
    tx.session.findUnique.mockResolvedValue({
      mfaVerifiedAt: new Date(),
      user: { mfaEnabled: false, deletedAt: new Date() },
    });

    await expect(avaliarGate("tok")).resolves.toEqual({
      liberado: false,
      motivo: "conta_excluida",
    });
  });

  it("bloqueia sessão com MFA ligado e ainda não verificada", async () => {
    tx.session.findUnique.mockResolvedValue({
      mfaVerifiedAt: null,
      user: { mfaEnabled: true, deletedAt: null },
    });

    await expect(avaliarGate("tok")).resolves.toEqual({
      liberado: false,
      motivo: "mfa_pendente",
    });
  });

  it("libera sessão verificada", async () => {
    tx.session.findUnique.mockResolvedValue({
      mfaVerifiedAt: new Date(),
      user: { mfaEnabled: true, deletedAt: null },
    });

    await expect(avaliarGate("tok")).resolves.toEqual({ liberado: true });
  });

  it("com a flag desligada não muda nada no produto", async () => {
    envMock.env.MFA_ENABLED = undefined as never;

    await expect(avaliarGate(null)).resolves.toEqual({ liberado: true });
  });
});

describe("verificarDesafio", () => {
  beforeEach(() => {
    mockRate.estaTravado.mockResolvedValue(false);
    mockDb.mfaChallenge.findUnique = tx.mfaChallenge.findUnique;
  });

  it("verifica só a sessão do desafio — outro dispositivo exige o seu", async () => {
    tx.mfaChallenge.findUnique.mockResolvedValue({
      id: "ch_1",
      codeHmac: hmacDoCodigo("ab12c"),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(verificarDesafio("sessao-A", "ab12c")).resolves.toEqual({
      ok: true,
    });

    expect(tx.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionToken: "sessao-A" } }),
    );
    expect(tx.mfaChallenge.findUnique).toHaveBeenCalledWith({
      where: { sessionToken: "sessao-A" },
    });
  });

  it("conta a falha no lockout quando o código está errado", async () => {
    tx.mfaChallenge.findUnique.mockResolvedValue({
      id: "ch_1",
      codeHmac: hmacDoCodigo("ab12c"),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const r = await verificarDesafio("sessao-A", "zzzzz");

    expect(r.ok).toBe(false);
    expect(mockRate.registrarFalhaDeCodigo).toHaveBeenCalledWith(
      "mfa:sessao-A",
    );
    expect(tx.session.update).not.toHaveBeenCalled();
  });

  it("recusa enquanto o lockout estiver ativo", async () => {
    mockRate.estaTravado.mockResolvedValue(true);
    tx.mfaChallenge.findUnique.mockResolvedValue({
      id: "ch_1",
      codeHmac: hmacDoCodigo("ab12c"),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const r = await verificarDesafio("sessao-A", "ab12c");

    expect(r).toMatchObject({ ok: false });
    expect(tx.session.update).not.toHaveBeenCalled();
  });

  it("recusa código expirado", async () => {
    tx.mfaChallenge.findUnique.mockResolvedValue({
      id: "ch_1",
      codeHmac: hmacDoCodigo("ab12c"),
      attempts: 0,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(verificarDesafio("sessao-A", "ab12c")).resolves.toMatchObject({
      ok: false,
    });
  });
});
