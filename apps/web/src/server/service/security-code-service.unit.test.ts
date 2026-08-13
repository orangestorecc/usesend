import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    securityCode: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/env", () => ({ env: { SECURITY_CODE_PEPPER: "pepper-de-teste" } }));

import {
  consumirCodigo,
  emitirCodigo,
  gerarCodigo,
  hmacDoCodigo,
  MAX_TENTATIVAS,
} from "~/server/service/security-code-service";

describe("gerarCodigo", () => {
  it("gera 5 caracteres do alfabeto do OTP de login", () => {
    for (let i = 0; i < 50; i++) {
      expect(gerarCodigo()).toMatch(/^[a-z0-9]{5}$/);
    }
  });
});

describe("hmacDoCodigo", () => {
  it("ignora caixa e espaços — quem digita 'AB12C ' acerta", () => {
    expect(hmacDoCodigo(" AB12C ")).toBe(hmacDoCodigo("ab12c"));
  });

  it("não guarda o código em claro", () => {
    expect(hmacDoCodigo("ab12c")).not.toContain("ab12c");
  });
});

describe("emitirCodigo", () => {
  beforeEach(() => {
    mockDb.securityCode.updateMany.mockResolvedValue({ count: 0 });
    mockDb.securityCode.create.mockResolvedValue({});
  });

  it("invalida os códigos anteriores da mesma finalidade", async () => {
    await emitirCodigo(1, "ACCOUNT_DELETE");

    expect(mockDb.securityCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, purpose: "ACCOUNT_DELETE", consumedAt: null },
      }),
    );
  });

  it("grava o HMAC e não o código", async () => {
    const codigo = await emitirCodigo(1, "MFA_ENABLE");
    const dados = mockDb.securityCode.create.mock.calls[0]![0].data;

    expect(dados.codeHmac).toBe(hmacDoCodigo(codigo));
    expect(JSON.stringify(dados)).not.toContain(codigo);
  });
});

describe("consumirCodigo", () => {
  function registro(over: Record<string, unknown> = {}) {
    return {
      id: "sc_1",
      codeHmac: hmacDoCodigo("ab12c"),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      ...over,
    };
  }

  beforeEach(() => {
    mockDb.securityCode.updateMany.mockResolvedValue({ count: 1 });
    mockDb.securityCode.update.mockResolvedValue({});
  });

  it("aceita o código correto e consome de forma atômica", async () => {
    mockDb.securityCode.findFirst.mockResolvedValue(registro());

    await expect(consumirCodigo(1, "MFA_ENABLE", "ab12c")).resolves.toEqual({
      ok: true,
    });

    expect(mockDb.securityCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sc_1", consumedAt: null },
      }),
    );
  });

  it("conta a tentativa quando o código está errado", async () => {
    mockDb.securityCode.findFirst.mockResolvedValue(registro());

    await expect(consumirCodigo(1, "MFA_ENABLE", "zzzzz")).resolves.toEqual({
      ok: false,
      motivo: "incorreto",
    });

    expect(mockDb.securityCode.update).toHaveBeenCalledWith({
      where: { id: "sc_1" },
      data: { attempts: { increment: 1 } },
    });
  });

  it("recusa código expirado", async () => {
    mockDb.securityCode.findFirst.mockResolvedValue(
      registro({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(consumirCodigo(1, "MFA_ENABLE", "ab12c")).resolves.toEqual({
      ok: false,
      motivo: "expirado",
    });
  });

  it("recusa depois do teto de tentativas, mesmo com o código certo", async () => {
    mockDb.securityCode.findFirst.mockResolvedValue(
      registro({ attempts: MAX_TENTATIVAS }),
    );

    await expect(consumirCodigo(1, "MFA_ENABLE", "ab12c")).resolves.toEqual({
      ok: false,
      motivo: "excedido",
    });
  });

  it("perde a corrida de dois consumos do mesmo código", async () => {
    mockDb.securityCode.findFirst.mockResolvedValue(registro());
    mockDb.securityCode.updateMany.mockResolvedValue({ count: 0 });

    await expect(consumirCodigo(1, "MFA_ENABLE", "ab12c")).resolves.toEqual({
      ok: false,
      motivo: "inexistente",
    });
  });
});
