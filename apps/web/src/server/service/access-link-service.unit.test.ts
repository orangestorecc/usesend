import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockCota, mockMail } = vi.hoisted(() => {
  const tx = {
    accessLink: { create: vi.fn() },
    userAuditLog: { create: vi.fn() },
  };
  return {
    mockDb: {
      ...tx,
      accessLink: {
        create: tx.accessLink.create,
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn(),
      },
      session: { deleteMany: vi.fn() },
      teamUser: { findUnique: vi.fn() },
      user: { findUnique: vi.fn() },
      domain: { findFirst: vi.fn() },
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      __tx: tx,
    },
    mockCota: vi.fn(),
    mockMail: vi.fn(),
  };
});

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/env", () => ({
  env: {
    NEXTAUTH_URL: "https://app.madmail.com.br",
    NEXTAUTH_SECRET: "segredo-de-teste",
    NODE_ENV: "production",
    FROM_EMAIL: "hello@madmail.com.br",
    USESEND_API_KEY: "us_teste",
  },
}));
vi.mock("~/server/logger/log", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("~/server/service/rate-limit-service", () => ({
  consumirCota: mockCota,
}));
vi.mock("~/server/mailer", () => ({ sendAccessLinkEmail: mockMail }));

import {
  ACCESS_LINK_LIMITE,
  ACCESS_LINK_LIMITE_POR_ALVO,
  ACCESS_LINK_VALIDADE_MINUTOS,
  consumirLinkDeAcesso,
  enviarLinkDeAcesso,
  gerarLinkDeAcesso,
  hashDoToken,
  invalidarLinksDoMembro,
} from "~/server/service/access-link-service";

const tx = (mockDb as any).__tx;

const ADMIN = { role: "ADMIN", user: { email: "admin@x.com" } };
const MEMBRO = {
  role: "MEMBER",
  user: {
    id: 7,
    email: "membro@x.com",
    name: "Membro",
    subjectId: "sub_7",
    deletedAt: null,
  },
};

const entrada = { teamId: 1, targetUserId: 7, atorUserId: 2 };
const entradaComTime = { ...entrada, teamName: "Time A" };

function comPapeis(ator: unknown, alvo: unknown) {
  mockDb.teamUser.findUnique.mockImplementation(async ({ where }: any) =>
    where.teamId_userId.userId === entrada.atorUserId ? ator : alvo,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCota.mockResolvedValue({ permitido: true, contagem: 1, limite: 10 });
  mockDb.domain.findFirst.mockResolvedValue({ id: 1 });
  comPapeis(ADMIN, MEMBRO);
});

describe("gerarLinkDeAcesso", () => {
  it("guarda só o hash com domínio próprio, nunca o token cru", async () => {
    const { url } = await gerarLinkDeAcesso(entrada);

    const token = url.split("/").pop()!;
    const esperado = createHash("sha256")
      .update(`access-link:${token}:segredo-de-teste`)
      .digest("hex");

    const data = tx.accessLink.create.mock.calls[0]![0].data;
    expect(data.tokenHash).toBe(esperado);
    expect(data.tokenHash).not.toBe(token);
  });

  it("aponta para a rota de resgate própria, não para o callback do NextAuth", async () => {
    const { url } = await gerarLinkDeAcesso(entrada);
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://app.madmail.com.br");
    expect(parsed.pathname).toMatch(
      /^\/api\/team\/access\/[0-9a-f]{64}$/,
    );
    expect(url).not.toContain("/api/auth/callback/email");
  });

  it("amarra o link ao time emissor e a quem emitiu", async () => {
    await gerarLinkDeAcesso(entrada);

    const data = tx.accessLink.create.mock.calls[0]![0].data;
    expect(data.teamId).toBe(1);
    expect(data.targetUserId).toBe(7);
    expect(data.createdByUserId).toBe(2);
    expect(data.usedAt).toBeUndefined();
  });

  it("expira em 30 minutos, e a mesma data vai para o banco", async () => {
    const { expiresAt } = await gerarLinkDeAcesso(entrada);

    const minutos = (expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(ACCESS_LINK_VALIDADE_MINUTOS - 1);
    expect(minutos).toBeLessThanOrEqual(ACCESS_LINK_VALIDADE_MINUTOS);
    expect(tx.accessLink.create.mock.calls[0]![0].data.expiresAt).toEqual(
      expiresAt,
    );
  });

  it("registra auditoria na mesma transação do token", async () => {
    await gerarLinkDeAcesso(entrada);

    const data = tx.userAuditLog.create.mock.calls[0]![0].data;
    expect(data.event).toBe("access_link_created");
    expect(data.actorUserId).toBe(2);
    expect(data.targetUserId).toBe(7);
    expect(data.targetSubject).toBe("sub_7");
    expect(data.metadata).toMatchObject({ teamId: 1 });
  });

  it("recusa quem não é ADMIN do time — sem tocar no banco de tokens", async () => {
    comPapeis({ role: "MEMBER", user: { email: "zé@x.com" } }, MEMBRO);

    await expect(gerarLinkDeAcesso(entrada)).rejects.toThrow(/admin/i);
    expect(tx.accessLink.create).not.toHaveBeenCalled();
  });

  it("recusa alvo que não é membro daquele time", async () => {
    comPapeis(ADMIN, null);

    await expect(gerarLinkDeAcesso(entrada)).rejects.toThrow(/membro/i);
    expect(tx.accessLink.create).not.toHaveBeenCalled();
  });

  it("recusa link para si mesmo", async () => {
    await expect(
      gerarLinkDeAcesso({ ...entrada, targetUserId: entrada.atorUserId }),
    ).rejects.toThrow(/própria conta/i);
    expect(tx.accessLink.create).not.toHaveBeenCalled();
  });

  it("recusa alvo que também é ADMIN do time", async () => {
    comPapeis(ADMIN, { ...MEMBRO, role: "ADMIN" });

    await expect(gerarLinkDeAcesso(entrada)).rejects.toThrow(
      /outro administrador/i,
    );
    expect(tx.accessLink.create).not.toHaveBeenCalled();
  });

  it("recusa conta excluída", async () => {
    comPapeis(ADMIN, { ...MEMBRO, user: { ...MEMBRO.user, deletedAt: new Date() } });

    await expect(gerarLinkDeAcesso(entrada)).rejects.toThrow(/excluída/i);
  });

  it("respeita o rate limit do ator e não gera token quando estoura", async () => {
    mockCota.mockImplementation(async (chave: string) => ({
      permitido: !chave.startsWith("access-link:"),
      contagem: 11,
      limite: ACCESS_LINK_LIMITE,
    }));

    await expect(gerarLinkDeAcesso(entrada)).rejects.toThrow(/links demais/i);
    expect(tx.accessLink.create).not.toHaveBeenCalled();
  });

  it("tem cota por ALVO: dois admins não somam 20 links na mesma vítima", async () => {
    mockCota.mockImplementation(async (chave: string) => ({
      permitido: !chave.startsWith("access-link-alvo:"),
      contagem: 6,
      limite: ACCESS_LINK_LIMITE_POR_ALVO,
    }));

    await expect(gerarLinkDeAcesso(entrada)).rejects.toThrow(
      /Esta pessoa já recebeu links demais/i,
    );
    expect(tx.accessLink.create).not.toHaveBeenCalled();

    // A chave do alvo não tem o teamId nem o ator: é a mesma para qualquer
    // admin de qualquer time, que é o ponto.
    const chaves = mockCota.mock.calls.map(([chave]) => chave);
    expect(chaves).toContain("access-link-alvo:7");
  });
});

describe("enviarLinkDeAcesso", () => {
  it("manda a URL para o dono da conta e não devolve para o admin", async () => {
    const resultado = await enviarLinkDeAcesso(entradaComTime);

    expect(resultado).not.toHaveProperty("url");
    expect(mockMail).toHaveBeenCalledOnce();
    const [destino, url, opcoes] = mockMail.mock.calls[0]!;
    expect(destino).toBe("membro@x.com");
    expect(url).toContain("/api/team/access/");
    expect(opcoes).toMatchObject({
      minutosDeValidade: ACCESS_LINK_VALIDADE_MINUTOS,
      quemLiberou: "admin@x.com",
      nomeDoWorkspace: "Time A",
    });
  });

  it("identifica quem liberou pelo NOME, não pelo e-mail cru", async () => {
    comPapeis(
      { role: "ADMIN", user: { email: "admin@x.com", name: "Ana Diretora" } },
      MEMBRO,
    );

    await enviarLinkDeAcesso(entradaComTime);

    expect(mockMail.mock.calls[0]![2]).toMatchObject({
      quemLiberou: "Ana Diretora",
    });
  });

  it("recusa enviar quando não há como dizer quem liberou", async () => {
    comPapeis({ role: "ADMIN", user: { email: null, name: null } }, MEMBRO);

    await expect(enviarLinkDeAcesso(entradaComTime)).rejects.toThrow(
      /nome no perfil/i,
    );
    expect(mockMail).not.toHaveBeenCalled();
    expect(tx.accessLink.create).not.toHaveBeenCalled();
  });

  it("alvo sem e-mail estoura na autorização, sem token, sem cota e sem auditoria", async () => {
    comPapeis(ADMIN, { ...MEMBRO, user: { ...MEMBRO.user, email: null } });

    await expect(enviarLinkDeAcesso(entradaComTime)).rejects.toThrow(
      /não tem e-mail/i,
    );
    expect(mockMail).not.toHaveBeenCalled();
    expect(tx.accessLink.create).not.toHaveBeenCalled();
    expect(tx.userAuditLog.create).not.toHaveBeenCalled();
    expect(mockCota).not.toHaveBeenCalled();
  });

  it("audita como envio, não como cópia de link", async () => {
    await enviarLinkDeAcesso(entradaComTime);

    expect(tx.userAuditLog.create.mock.calls[0]![0].data.event).toBe(
      "access_link_sent",
    );
  });

  it("não envia e-mail se a autorização falhar", async () => {
    comPapeis({ role: "MEMBER", user: { email: "zé@x.com" } }, MEMBRO);

    await expect(enviarLinkDeAcesso(entradaComTime)).rejects.toThrow();
    expect(mockMail).not.toHaveBeenCalled();
  });

  it("falha cedo, sem queimar cota, quando não há como enviar e-mail", async () => {
    mockDb.domain.findFirst.mockResolvedValue(null);
    // Sem API key externa útil: o caminho interno precisa de domínio verificado.
    const env = (await import("~/env")).env as any;
    const apiKey = env.USESEND_API_KEY;
    env.USESEND_API_KEY = undefined;

    try {
      await expect(enviarLinkDeAcesso(entradaComTime)).rejects.toThrow(
        /domínio verificado/i,
      );
      expect(mockCota).not.toHaveBeenCalled();
      expect(tx.accessLink.create).not.toHaveBeenCalled();
    } finally {
      env.USESEND_API_KEY = apiKey;
    }
  });

  it("erro de configuração não vaza nome de variável de ambiente", async () => {
    const env = (await import("~/env")).env as any;
    const url = env.NEXTAUTH_URL;
    env.NEXTAUTH_URL = undefined;

    try {
      await expect(gerarLinkDeAcesso(entrada)).rejects.toThrow(
        /endereço público/i,
      );
      await expect(gerarLinkDeAcesso(entrada)).rejects.not.toThrow(
        /NEXTAUTH/,
      );
    } finally {
      env.NEXTAUTH_URL = url;
    }
  });
});

describe("consumirLinkDeAcesso", () => {
  it("uso único sob corrida: o segundo resgate simultâneo não abre sessão", async () => {
    const link = {
      id: "lnk_1",
      teamId: 1,
      targetUserId: 7,
      createdByUserId: 2,
    };
    // Update condicional: só o primeiro chamador vê count 1.
    let restantes = 1;
    mockDb.accessLink.updateMany.mockImplementation(async () => ({
      count: restantes-- > 0 ? 1 : 0,
    }));
    mockDb.accessLink.findUnique.mockResolvedValue(link);

    const token = "c".repeat(64);
    const [a, b] = await Promise.all([
      consumirLinkDeAcesso(token),
      consumirLinkDeAcesso(token),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(a ?? b).toMatchObject(link);
  });

  it("marca usedAt no próprio update, sem read-then-write", async () => {
    mockDb.accessLink.updateMany.mockResolvedValue({ count: 1 });
    mockDb.accessLink.findUnique.mockResolvedValue({
      id: "lnk_1",
      teamId: 1,
      targetUserId: 7,
      createdByUserId: 2,
    });

    await consumirLinkDeAcesso("d".repeat(64));

    const [{ where, data }] = mockDb.accessLink.updateMany.mock.calls[0]!;
    expect(where.usedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(where.tokenHash).toBe(hashDoToken("d".repeat(64)));
    expect(data.usedAt).toBeInstanceOf(Date);
  });

  it("token expirado ou já usado devolve null", async () => {
    mockDb.accessLink.updateMany.mockResolvedValue({ count: 0 });

    expect(await consumirLinkDeAcesso("e".repeat(64))).toBeNull();
  });
});

describe("invalidarLinksDoMembro", () => {
  it("apaga links pendentes e derruba as sessões presas àquele time", async () => {
    await invalidarLinksDoMembro(1, 7);

    expect(mockDb.accessLink.deleteMany).toHaveBeenCalledWith({
      where: { teamId: 1, targetUserId: 7, usedAt: null },
    });
    expect(mockDb.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7, accessLinkTeamId: 1 },
    });
  });
});
