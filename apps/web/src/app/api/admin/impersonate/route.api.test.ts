import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetServerAuthSession,
  mockEhAdmin,
  mockTrava,
  mockFindFirst,
  mockCriarSessao,
  mockCookies,
} = vi.hoisted(() => ({
  mockGetServerAuthSession: vi.fn(),
  mockEhAdmin: vi.fn(),
  mockTrava: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCriarSessao: vi.fn(),
  mockCookies: vi.fn(),
}));

vi.mock("~/server/auth", () => ({
  getServerAuthSession: mockGetServerAuthSession,
}));

vi.mock("next/headers", () => ({ cookies: mockCookies }));

vi.mock("~/server/db", () => ({
  db: { teamUser: { findFirst: mockFindFirst } },
}));

vi.mock("~/env", () => ({
  env: { NEXTAUTH_URL: "https://app.madmail.com.br" },
}));

vi.mock("~/server/service/platform-admin", () => ({
  ehAdminDaPlataformaPorId: mockEhAdmin,
}));

vi.mock("~/server/service/active-team", () => ({
  lerTravaDeLinkDeAcesso: mockTrava,
}));

vi.mock("~/server/service/session-service", () => ({
  SESSION_COOKIE: "next-auth.session-token",
  opcoesDeCookie: () => ({ httpOnly: true, path: "/" }),
  criarSessaoEGravarCookie: mockCriarSessao,
}));

import { GET } from "~/app/api/admin/impersonate/route";

function req() {
  return new Request("http://localhost/api/admin/impersonate?teamId=7");
}

describe("GET /api/admin/impersonate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerAuthSession.mockResolvedValue({ user: { id: 1 } });
    mockEhAdmin.mockResolvedValue(true);
    mockTrava.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue({ teamId: 7, userId: 42 });
    mockCookies.mockResolvedValue({ get: () => ({ value: "token-do-admin" }) });
    mockCriarSessao.mockResolvedValue("nova");
  });

  it("recusa com 403 quando a sessão está presa a um link de acesso — e não cria sessão", async () => {
    // Cenário do escape: admin de plataforma que também é membro comum de um
    // workspace resgata um link de acesso e usa esta rota para sair com uma
    // sessão limpa, sem a trava.
    mockTrava.mockResolvedValue(3);

    const res = await GET(req());

    expect(res.status).toBe(403);
    expect(mockCriarSessao).not.toHaveBeenCalled();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("recusa com 403 quem não é admin de plataforma", async () => {
    mockEhAdmin.mockResolvedValue(false);

    const res = await GET(req());

    expect(res.status).toBe(403);
    expect(mockCriarSessao).not.toHaveBeenCalled();
  });

  it("segue funcionando para admin de plataforma em sessão normal", async () => {
    const res = await GET(req());

    expect(res.status).toBe(307);
    expect(mockCriarSessao).toHaveBeenCalledTimes(1);
    expect(mockCriarSessao.mock.calls[0]?.[0]).toBe(42);
    // Sessão de impersonation nasce SEM trava de link de acesso.
    expect(mockCriarSessao.mock.calls[0]?.[2]).not.toHaveProperty(
      "accessLinkTeamId",
    );
    expect(res.cookies.get("madmail-impersonator")?.value).toBe(
      "token-do-admin",
    );
  });

  it("escolhe o membro do time de forma determinística (orderBy explícito)", async () => {
    await GET(req());

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { teamId: 7, role: "ADMIN" },
      orderBy: { userId: "asc" },
    });
  });
});
