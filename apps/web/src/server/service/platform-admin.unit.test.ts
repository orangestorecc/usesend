import { describe, it, expect, vi, beforeEach } from "vitest";

const userCount = vi.fn();
const userFindUnique = vi.fn();
const envMock = { ADMIN_EMAIL: "rafael@n49.com.br" as string | undefined };

vi.mock("~/env", () => ({
  get env() {
    return envMock;
  },
}));

vi.mock("~/server/db", () => ({
  db: {
    user: {
      count: (...args: unknown[]) => userCount(...args),
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

import {
  ehAdminDaPlataforma,
  ehAdminDaPlataformaPorId,
  podeRemoverAdmin,
} from "./platform-admin";

describe("ehAdminDaPlataforma", () => {
  beforeEach(() => {
    envMock.ADMIN_EMAIL = "rafael@n49.com.br";
    userCount.mockReset();
    userFindUnique.mockReset();
  });

  it("aceita quem tem a coluna isAdmin", () => {
    expect(
      ehAdminDaPlataforma({ email: "josuex220@gmail.com", isAdmin: true }),
    ).toBe(true);
  });

  it("aceita o dono do ADMIN_EMAIL mesmo sem a coluna", () => {
    expect(
      ehAdminDaPlataforma({ email: "rafael@n49.com.br", isAdmin: false }),
    ).toBe(true);
  });

  it("compara o ADMIN_EMAIL sem diferenciar maiúsculas", () => {
    expect(
      ehAdminDaPlataforma({ email: "Rafael@N49.com.BR", isAdmin: false }),
    ).toBe(true);
  });

  it("recusa quem não é nem uma coisa nem outra", () => {
    expect(
      ehAdminDaPlataforma({ email: "qualquer@cliente.com", isAdmin: false }),
    ).toBe(false);
  });

  it("recusa sem e-mail e sem coluna", () => {
    expect(ehAdminDaPlataforma({ email: null, isAdmin: false })).toBe(false);
  });

  it("não vira admin geral quando ADMIN_EMAIL não está configurado", () => {
    envMock.ADMIN_EMAIL = undefined;
    expect(ehAdminDaPlataforma({ email: "qualquer@x.com" })).toBe(false);
  });
});

describe("ehAdminDaPlataformaPorId", () => {
  beforeEach(() => {
    envMock.ADMIN_EMAIL = "rafael@n49.com.br";
    userFindUnique.mockReset();
  });

  it("recusa conta excluída, mesmo sendo o ADMIN_EMAIL", async () => {
    userFindUnique.mockResolvedValue({
      email: "rafael@n49.com.br",
      isAdmin: true,
      deletedAt: new Date(),
    });
    await expect(ehAdminDaPlataformaPorId(1)).resolves.toBe(false);
  });

  it("recusa conta inexistente", async () => {
    userFindUnique.mockResolvedValue(null);
    await expect(ehAdminDaPlataformaPorId(99)).resolves.toBe(false);
  });

  it("aceita admin ativo", async () => {
    userFindUnique.mockResolvedValue({
      email: "josuex220@gmail.com",
      isAdmin: true,
      deletedAt: null,
    });
    await expect(ehAdminDaPlataformaPorId(7)).resolves.toBe(true);
  });
});

describe("podeRemoverAdmin", () => {
  beforeEach(() => {
    envMock.ADMIN_EMAIL = "rafael@n49.com.br";
    userCount.mockReset();
  });

  it("impede remover a si mesmo", async () => {
    const r = await podeRemoverAdmin(2, 2);
    expect(r.pode).toBe(false);
    expect(userCount).not.toHaveBeenCalled();
  });

  it("permite remover outra pessoa", async () => {
    userCount.mockResolvedValue(1);
    await expect(podeRemoverAdmin(7, 2)).resolves.toMatchObject({ pode: true });
  });

  it("permite esvaziar a lista quando o ADMIN_EMAIL segura a instalação", async () => {
    userCount.mockResolvedValue(0);
    await expect(podeRemoverAdmin(7, 2)).resolves.toMatchObject({ pode: true });
  });

  it("impede remover o último admin quando não há ADMIN_EMAIL", async () => {
    envMock.ADMIN_EMAIL = undefined;
    userCount.mockResolvedValue(0);
    const r = await podeRemoverAdmin(7, 2);
    expect(r.pode).toBe(false);
    expect(r.motivo).toMatch(/último admin/i);
  });
});
