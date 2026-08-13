import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockCheckTeamMemberLimit } = vi.hoisted(() => ({
  mockDb: {
    teamInvite: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    teamUser: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  mockCheckTeamMemberLimit: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

vi.mock("~/server/auth", () => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock("~/server/service/limit-service", () => ({
  LimitService: { checkTeamMemberLimit: mockCheckTeamMemberLimit },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { invitationRouter } from "~/server/api/routers/invitiation";
import { INVITE_BLOQUEADO_POR_LIMITE } from "~/lib/invites";

const createCaller = createCallerFactory(invitationRouter);

function contexto(email = "convidado@example.com") {
  return {
    db: mockDb,
    headers: new Headers(),
    session: {
      user: {
        id: 7,
        email,
        isWaitlisted: false,
        isAdmin: false,
        isBetaUser: true,
      },
    },
  } as any;
}

function convite(over: Record<string, unknown> = {}) {
  return {
    id: "inv_1",
    teamId: 1,
    email: "convidado@example.com",
    role: "MEMBER",
    createdAt: new Date(),
    ...over,
  };
}

describe("invitationRouter.acceptTeamInvite", () => {
  beforeEach(() => {
    mockCheckTeamMemberLimit.mockResolvedValue({
      isLimitReached: false,
      limit: 5,
    });
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb));
    mockDb.$executeRaw.mockResolvedValue(1);
    mockDb.user.findUnique.mockResolvedValue({ deletedAt: null });
    mockDb.teamInvite.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.teamUser.create.mockResolvedValue({});
  });

  it("recusa convite endereçado a outra pessoa", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(
      convite({ email: "outro@example.com" }),
    );

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.teamUser.create).not.toHaveBeenCalled();
  });

  it("aceita ignorando diferença de maiúsculas no e-mail", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(
      convite({ email: "Convidado@Example.com" }),
    );

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).resolves.toBe(true);

    expect(mockDb.teamUser.create).toHaveBeenCalled();
  });

  it("recusa convite expirado (mais de 7 dias)", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(
      convite({
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      }),
    );

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.teamUser.create).not.toHaveBeenCalled();
  });

  it("bloqueia quando o time estourou o limite do plano, sem queimar o convite", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(convite());
    mockCheckTeamMemberLimit.mockResolvedValue({
      isLimitReached: true,
      limit: 1,
    });

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: INVITE_BLOQUEADO_POR_LIMITE,
    });

    expect(mockDb.teamInvite.deleteMany).not.toHaveBeenCalled();
    expect(mockDb.teamUser.create).not.toHaveBeenCalled();
  });

  it("recusa aceite de conta já excluída (corrida com o delete)", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(convite());
    mockDb.user.findUnique.mockResolvedValue({ deletedAt: new Date() });

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mockDb.teamUser.create).not.toHaveBeenCalled();
  });

  it("perde a corrida de dois aceites do mesmo convite sem criar vínculo duplo", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(convite());
    mockDb.teamInvite.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.teamUser.create).not.toHaveBeenCalled();
  });
});

describe("invitationRouter.getInvite", () => {
  it("não devolve convite de outra pessoa (enumeração por id)", async () => {
    mockDb.teamInvite.findFirst.mockResolvedValue(null);

    await expect(
      createCaller(contexto()).getInvite({ inviteId: "inv_alheio" }),
    ).resolves.toBeNull();

    expect(mockDb.teamInvite.findFirst).toHaveBeenCalledWith({
      where: {
        id: "inv_alheio",
        email: { equals: "convidado@example.com", mode: "insensitive" },
      },
    });
  });
});
