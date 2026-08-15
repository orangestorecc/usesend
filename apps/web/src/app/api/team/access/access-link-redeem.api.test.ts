import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockConsumir, mockGateDeMfa, mockAuditoria } = vi.hoisted(
  () => {
    const tx = { session: { create: vi.fn() } };
    return {
      mockDb: {
        teamUser: { findUnique: vi.fn() },
        session: { create: tx.session.create },
        $transaction: vi.fn(async (fn: any) => fn(tx)),
        __tx: tx,
      },
      mockConsumir: vi.fn(),
      mockGateDeMfa: vi.fn(),
      mockAuditoria: vi.fn(),
    };
  },
);

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/env", () => ({
  env: {
    // https ⇒ cookie com prefixo `__Secure-` e flag `secure`.
    NEXTAUTH_URL: "https://app.madmail.com.br",
    NEXTAUTH_SECRET: "segredo-de-teste",
    NODE_ENV: "production",
  },
}));
vi.mock("~/server/logger/log", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("~/server/service/audit-service", () => ({
  registrarAuditoria: mockAuditoria,
}));
vi.mock("~/server/service/mfa-service", () => ({
  aplicarGateDeMfaNaSessao: mockGateDeMfa,
}));
vi.mock("~/server/service/access-link-service", () => ({
  ACCESS_LINK_SESSAO_HORAS: 8,
  consumirLinkDeAcesso: mockConsumir,
}));

import { GET } from "~/app/api/team/access/[token]/route";

const TOKEN = "a".repeat(64);
const LINK = { id: "lnk_1", teamId: 1, targetUserId: 7, createdByUserId: 2 };
const VINCULO = {
  role: "MEMBER",
  team: { name: "Time A" },
  user: {
    id: 7,
    email: "membro@x.com",
    subjectId: "sub_7",
    deletedAt: null,
  },
};

function resgatar(token = TOKEN) {
  return GET(new Request(`https://app.madmail.com.br/api/team/access/${token}`), {
    params: Promise.resolve({ token }),
  });
}

/** O destino do redirect diz se foi sucesso ou recusa. */
function destino(res: Response) {
  return new URL(res.headers.get("location")!);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConsumir.mockResolvedValue(LINK);
  mockDb.teamUser.findUnique.mockResolvedValue(VINCULO);
});

describe("GET /api/team/access/[token] — recusas", () => {
  it("token com formato errado nem chega ao banco", async () => {
    const res = await resgatar("nao-e-hex");

    expect(destino(res).pathname).toBe("/login");
    expect(destino(res).searchParams.get("error")).toBe("access_link_invalido");
    expect(mockConsumir).not.toHaveBeenCalled();
    expect(mockDb.__tx.session.create).not.toHaveBeenCalled();
  });

  it("token expirado ou já usado não abre sessão", async () => {
    // `consumirLinkDeAcesso` devolve null nos dois casos: o update condicional
    // (`usedAt: null` + `expiresAt > agora`) não acha linha.
    mockConsumir.mockResolvedValue(null);

    const res = await resgatar();

    expect(destino(res).searchParams.get("error")).toBe("access_link_invalido");
    expect(mockDb.__tx.session.create).not.toHaveBeenCalled();
    expect(res.cookies.get("__Secure-next-auth.session-token")).toBeUndefined();
  });

  it("vínculo que morreu entre a emissão e o clique não abre sessão", async () => {
    mockDb.teamUser.findUnique.mockResolvedValue(null);

    const res = await resgatar();

    expect(destino(res).searchParams.get("error")).toBe("access_link_invalido");
    expect(mockDb.__tx.session.create).not.toHaveBeenCalled();
  });

  it("conta excluída não abre sessão", async () => {
    mockDb.teamUser.findUnique.mockResolvedValue({
      ...VINCULO,
      user: { ...VINCULO.user, deletedAt: new Date() },
    });

    const res = await resgatar();

    expect(destino(res).searchParams.get("error")).toBe("access_link_invalido");
    expect(mockDb.__tx.session.create).not.toHaveBeenCalled();
  });

  it("alvo promovido a ADMIN depois da emissão não abre sessão", async () => {
    mockDb.teamUser.findUnique.mockResolvedValue({ ...VINCULO, role: "ADMIN" });

    const res = await resgatar();

    expect(destino(res).searchParams.get("error")).toBe("access_link_invalido");
    expect(mockDb.__tx.session.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/team/access/[token] — resgate válido", () => {
  it("leva ao dashboard e prende a sessão ao time emissor", async () => {
    const res = await resgatar();

    expect(destino(res).pathname).toBe("/dashboard");

    const { data } = mockDb.__tx.session.create.mock.calls[0]![0];
    expect(data.userId).toBe(7);
    expect(data.accessLinkTeamId).toBe(1);
  });

  it("o cookie entregue é o mesmo sessionToken gravado no banco", async () => {
    const res = await resgatar();

    const gravado = mockDb.__tx.session.create.mock.calls[0]![0].data
      .sessionToken as string;
    const cookie = res.cookies.get("__Secure-next-auth.session-token")!;

    expect(cookie.value).toBe(gravado);
    expect(gravado).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o cookie de sessão é httpOnly, secure e expira junto com a sessão", async () => {
    const res = await resgatar();

    const cookie = res.cookies.get("__Secure-next-auth.session-token")!;
    const { expires } = mockDb.__tx.session.create.mock.calls[0]![0].data;

    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
    expect(cookie.expires).toEqual(expires);
    // 8 horas, não os 30 dias do login normal: isto é acesso assistido.
    const horas = (expires.getTime() - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(7.9);
    expect(horas).toBeLessThanOrEqual(8);
  });

  it("aplica o mesmo gate de MFA do login normal, com o token recém-criado", async () => {
    await resgatar();

    const gravado = mockDb.__tx.session.create.mock.calls[0]![0].data
      .sessionToken as string;
    expect(mockGateDeMfa).toHaveBeenCalledWith(gravado, 7);
  });

  it("audita o uso na mesma transação da sessão", async () => {
    await resgatar();

    const [evento, dados] = mockAuditoria.mock.calls[0]!;
    expect(evento).toBe("access_link_redeemed");
    // Ator é quem emitiu: sem isto as ações do admin viram ações da vítima.
    expect(dados.actorUserId).toBe(2);
    expect(dados.targetUserId).toBe(7);
    expect(dados.metadata).toMatchObject({ teamId: 1, accessLinkId: "lnk_1" });
  });
});
