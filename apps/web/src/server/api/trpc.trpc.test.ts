import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    teamUser: {
      findFirst: vi.fn(),
    },
    // A trava de link de acesso mora na row de `Session`.
    session: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

vi.mock("~/server/auth", () => ({
  getServerAuthSession: vi.fn(),
}));

import { z } from "zod";

import {
  adminProcedure,
  authedProcedure,
  createCallerFactory,
  createTRPCRouter,
  protectedProcedure,
  semAcessoAssistidoProcedure,
  teamAdminProcedure,
  teamProcedure,
} from "~/server/api/trpc";

const testRouter = createTRPCRouter({
  authedPing: authedProcedure.query(({ ctx }) => ({
    userId: ctx.session.user.id,
  })),
  protectedPing: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.session.user.id,
  })),
  /** Procedure genérica com `teamId` no input — o padrão que a trava cobre. */
  comTeamId: protectedProcedure
    .input(z.object({ teamId: z.number() }))
    .query(({ input }) => ({ teamId: input.teamId })),
  adminPing: adminProcedure.query(() => ({ ok: true })),
  /** O caso sem `teamId` no input que o choke point genérico não alcança. */
  semAcessoAssistidoPing: semAcessoAssistidoProcedure.query(() => ({
    ok: true,
  })),
  teamPing: teamProcedure.query(({ ctx }) => ({ teamId: ctx.team.id })),
  teamAdminPing: teamAdminProcedure.query(({ ctx }) => ({
    role: ctx.teamUser.role,
  })),
});

const createCaller = createCallerFactory(testRouter);

function getContext(
  session: Record<string, unknown> | null,
  headers = new Headers(),
) {
  return {
    db: mockDb,
    session,
    headers,
  } as any;
}

const baseUser = {
  id: 1,
  isBetaUser: true,
  isAdmin: false,
  isWaitlisted: false,
  email: "user@example.com",
};

describe("tRPC middleware procedures", () => {
  beforeEach(() => {
    mockDb.teamUser.findFirst.mockReset();
    mockDb.session.findUnique.mockReset();
    mockDb.session.findUnique.mockResolvedValue({ accessLinkTeamId: null });
  });

  it("blocks authed procedure without session", async () => {
    const caller = createCaller(getContext(null));
    await expect(caller.authedPing()).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.authedPing()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("blocks protected procedure for waitlisted users", async () => {
    const caller = createCaller(
      getContext({
        user: { ...baseUser, isWaitlisted: true },
      }),
    );

    await expect(caller.protectedPing()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("loads team context for team procedure", async () => {
    mockDb.teamUser.findFirst.mockResolvedValue({
      teamId: 10,
      userId: 1,
      role: "ADMIN",
      team: { id: 10, name: "Acme" },
    });

    const caller = createCaller(
      getContext({
        user: baseUser,
      }),
    );

    await expect(caller.teamPing()).resolves.toEqual({ teamId: 10 });
  });

  it("blocks team admin procedure for non-admin team users", async () => {
    mockDb.teamUser.findFirst.mockResolvedValue({
      teamId: 10,
      userId: 1,
      role: "MEMBER",
      team: { id: 10, name: "Acme" },
    });

    const caller = createCaller(
      getContext({
        user: baseUser,
      }),
    );

    await expect(caller.teamAdminPing()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("fails team procedure when user has no team", async () => {
    mockDb.teamUser.findFirst.mockResolvedValue(null);

    const caller = createCaller(
      getContext({
        user: baseUser,
      }),
    );

    await expect(caller.teamPing()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("usa o workspace do cookie quando o vínculo existe", async () => {
    mockDb.teamUser.findFirst.mockResolvedValue({
      teamId: 42,
      userId: 1,
      role: "ADMIN",
      team: { id: 42, name: "Segundo" },
    });

    const caller = createCaller(
      getContext(
        { user: baseUser },
        new Headers({ cookie: "madmail-workspace=42" }),
      ),
    );

    await expect(caller.teamPing()).resolves.toEqual({ teamId: 42 });
    expect(mockDb.teamUser.findFirst).toHaveBeenCalledWith({
      where: { userId: 1, teamId: 42 },
      include: { team: true },
    });
  });

  it("ignora cookie de time alheio e cai no fallback ordenado", async () => {
    // Primeira chamada (cookie) não acha vínculo; segunda é o fallback.
    mockDb.teamUser.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        teamId: 10,
        userId: 1,
        role: "MEMBER",
        team: { id: 10, name: "Acme" },
      });

    const caller = createCaller(
      getContext(
        { user: baseUser },
        new Headers({ cookie: "madmail-workspace=999" }),
      ),
    );

    await expect(caller.teamPing()).resolves.toEqual({ teamId: 10 });
    expect(mockDb.teamUser.findFirst).toHaveBeenLastCalledWith({
      where: { userId: 1 },
      include: { team: true },
      orderBy: { teamId: "asc" },
    });
  });

  it("fallback sem cookie é determinístico por teamId", async () => {
    mockDb.teamUser.findFirst.mockResolvedValue({
      teamId: 10,
      userId: 1,
      role: "ADMIN",
      team: { id: 10, name: "Acme" },
    });

    const caller = createCaller(getContext({ user: baseUser }));

    await expect(caller.teamPing()).resolves.toEqual({ teamId: 10 });
    expect(mockDb.teamUser.findFirst).toHaveBeenCalledWith({
      where: { userId: 1 },
      include: { team: true },
      orderBy: { teamId: "asc" },
    });
  });
});

/**
 * A trava vive na camada de AUTENTICAÇÃO (`protectedProcedure`), não na
 * resolução de time ativo: senão toda procedure que recebe `teamId` do cliente
 * — e são muitas — fica de fora dela.
 */
describe("trava de link de acesso no protectedProcedure", () => {
  const presa = () => {
    // A mesma row serve ao `avaliarGate` (MFA/conta excluída) e à trava.
    mockDb.session.findUnique.mockResolvedValue({
      accessLinkTeamId: 1,
      mfaVerifiedAt: null,
      user: { mfaEnabled: false, deletedAt: null },
    });
    return createCaller(
      getContext(
        { user: baseUser },
        new Headers({ cookie: "next-auth.session-token=abc" }),
      ),
    );
  };

  beforeEach(() => {
    mockDb.teamUser.findFirst.mockReset();
    mockDb.session.findUnique.mockReset();
  });

  it("barra `teamId` de input diferente do time travado", async () => {
    await expect(presa().comTeamId({ teamId: 2 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("deixa passar o `teamId` do próprio time travado", async () => {
    await expect(presa().comTeamId({ teamId: 1 })).resolves.toEqual({
      teamId: 1,
    });
  });

  it("não atrapalha procedure sem `teamId` no input", async () => {
    await expect(presa().protectedPing()).resolves.toEqual({ userId: 1 });
  });

  it("sessão travada não mexe em vínculo de time sem `teamId` no input", async () => {
    await expect(presa().semAcessoAssistidoPing()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("sessão normal passa pelas duas travas", async () => {
    mockDb.session.findUnique.mockResolvedValue({
      accessLinkTeamId: null,
      mfaVerifiedAt: null,
      user: { mfaEnabled: false, deletedAt: null },
    });
    const caller = createCaller(
      getContext(
        { user: baseUser },
        new Headers({ cookie: "next-auth.session-token=abc" }),
      ),
    );

    await expect(caller.comTeamId({ teamId: 99 })).resolves.toEqual({
      teamId: 99,
    });
    await expect(caller.semAcessoAssistidoPing()).resolves.toEqual({ ok: true });
  });

  it("sessão travada não administra a plataforma", async () => {
    await expect(presa().adminPing()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lê a trava uma vez só por request, mesmo no teamProcedure", async () => {
    // A mesma row serve ao `avaliarGate` (MFA/conta excluída) e à trava.
    mockDb.session.findUnique.mockResolvedValue({
      accessLinkTeamId: 1,
      mfaVerifiedAt: null,
      user: { mfaEnabled: false, deletedAt: null },
    });
    mockDb.teamUser.findFirst.mockResolvedValue({
      teamId: 1,
      userId: 1,
      role: "MEMBER",
      team: { id: 1, name: "Acme" },
    });

    const caller = createCaller(
      getContext(
        { user: baseUser },
        new Headers({ cookie: "next-auth.session-token=abc" }),
      ),
    );

    await expect(caller.teamPing()).resolves.toEqual({ teamId: 1 });
    // A trava é lida UMA vez: antes, `teamProcedure` chamava `resolverTimeAtivo`
    // (que já lia) e logo em seguida `lerTravaDeLinkDeAcesso` de novo.
    const leiturasDaTrava = mockDb.session.findUnique.mock.calls.filter(
      ([args]: any) => args?.select?.accessLinkTeamId,
    );
    expect(leiturasDaTrava).toHaveLength(1);
    // E o time resolvido é o travado, sem consultar cookie de workspace.
    expect(mockDb.teamUser.findFirst).toHaveBeenCalledWith({
      where: { userId: 1, teamId: 1 },
      include: { team: true },
    });
  });
});
