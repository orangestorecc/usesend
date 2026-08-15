import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetServerAuthSession, mockPertence, mockTrava } = vi.hoisted(() => ({
  mockGetServerAuthSession: vi.fn(),
  mockPertence: vi.fn(),
  mockTrava: vi.fn(),
}));

vi.mock("~/server/auth", () => ({
  getServerAuthSession: mockGetServerAuthSession,
}));

vi.mock("~/server/db", () => ({ db: {} }));

vi.mock("~/env", () => ({
  env: { NEXTAUTH_URL: "https://app.madmail.com.br" },
}));

vi.mock("~/server/service/active-team", async () => {
  const real = await vi.importActual<
    typeof import("~/server/service/active-team")
  >("~/server/service/active-team");
  return {
    WORKSPACE_COOKIE: real.WORKSPACE_COOKIE,
    WORKSPACE_COOKIE_MAX_AGE: real.WORKSPACE_COOKIE_MAX_AGE,
    usuarioPertenceAoTime: mockPertence,
    // Trava de link de acesso é de outro caso de teste; aqui é sessão normal.
    lerTravaDeLinkDeAcesso: mockTrava,
  };
});

import { POST } from "~/app/api/workspace/select/route";
import {
  WORKSPACE_COOKIE,
  WORKSPACE_COOKIE_MAX_AGE,
} from "~/server/service/active-team";

function req(body: unknown) {
  return new Request("http://localhost/api/workspace/select", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/workspace/select", () => {
  beforeEach(() => {
    mockGetServerAuthSession.mockReset();
    mockPertence.mockReset();
    mockTrava.mockReset();
    mockTrava.mockResolvedValue(null);
    mockGetServerAuthSession.mockResolvedValue({ user: { id: 1 } });
    mockPertence.mockResolvedValue(true);
  });

  it("recusa deslogado com 401 e sem gravar cookie", async () => {
    mockGetServerAuthSession.mockResolvedValue(null);

    const res = await POST(req({ teamId: 2 }));

    expect(res.status).toBe(401);
    expect(res.cookies.get(WORKSPACE_COOKIE)).toBeUndefined();
  });

  it("recusa teamId inválido com 400", async () => {
    const res = await POST(req({ teamId: "abc" }));

    expect(res.status).toBe(400);
    expect(mockPertence).not.toHaveBeenCalled();
  });

  it("recusa 403 quando o usuário não é do time — sem gravar cookie", async () => {
    mockPertence.mockResolvedValue(false);

    const res = await POST(req({ teamId: 99 }));

    expect(res.status).toBe(403);
    expect(res.cookies.get(WORKSPACE_COOKIE)).toBeUndefined();
  });

  it("grava o cookie com prazo — não pode virar cookie de sessão do browser", async () => {
    const res = await POST(req({ teamId: 7 }));

    expect(res.status).toBe(200);
    const cookie = res.cookies.get(WORKSPACE_COOKIE);
    expect(cookie?.value).toBe("7");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.maxAge).toBe(WORKSPACE_COOKIE_MAX_AGE);
    expect(cookie?.maxAge).toBeGreaterThan(0);
  });
});
