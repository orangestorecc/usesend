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
      createMany: vi.fn(),
      findFirst: vi.fn(),
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
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    mockDb.teamUser.createMany.mockResolvedValue({ count: 1 });
    mockDb.teamUser.findFirst.mockResolvedValue(null);
  });

  it("recusa convite endereçado a outra pessoa", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(
      convite({ email: "outro@example.com" }),
    );

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.teamUser.createMany).not.toHaveBeenCalled();
  });

  it("aceita ignorando diferença de maiúsculas no e-mail", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(
      convite({ email: "Convidado@Example.com" }),
    );

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).resolves.toBe(true);

    expect(mockDb.teamUser.createMany).toHaveBeenCalled();
  });

  it("recusa convite expirado (mais de 7 dias)", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(
      convite({
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }),
    );

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.teamUser.createMany).not.toHaveBeenCalled();
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
    expect(mockDb.teamUser.createMany).not.toHaveBeenCalled();
  });

  it("recusa aceite de conta já excluída (corrida com o delete)", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(convite());
    mockDb.user.findUnique.mockResolvedValue({ deletedAt: new Date() });

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mockDb.teamUser.createMany).not.toHaveBeenCalled();
  });

  it("perde a corrida de dois aceites do mesmo convite sem criar vínculo duplo", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(convite());
    mockDb.teamInvite.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.teamUser.createMany).not.toHaveBeenCalled();
  });

  it("é idempotente: quem já é membro aceita de novo sem estourar unique", async () => {
    mockDb.teamInvite.findUnique.mockResolvedValue(convite());
    mockDb.teamUser.findFirst.mockResolvedValue({ teamId: 1 });

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).resolves.toBe(true);

    // Convite é consumido, mas nenhum vínculo novo é criado.
    expect(mockDb.teamInvite.deleteMany).toHaveBeenCalledWith({
      where: { id: "inv_1" },
    });
    expect(mockDb.teamUser.createMany).not.toHaveBeenCalled();
  });

  it("cria o vínculo com o papel do convite e o usuário da SESSÃO", async () => {
    // O convite carrega o papel; quem entra é sempre quem está logado, nunca
    // um id vindo do input.
    mockDb.teamInvite.findUnique.mockResolvedValue(
      convite({ role: "ADMIN", teamId: 42 }),
    );

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).resolves.toBe(true);

    expect(mockDb.teamUser.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ teamId: 42, userId: 7, role: "ADMIN" }],
      }),
    );
  });

  it("aceita convite reenviado: o prazo vale por expiresAt, não por createdAt", async () => {
    // Convite criado há 8 dias mas renovado no reenvio — o aceite tem que
    // passar. Era exatamente o caso que o botão "Reenviar convite" quebrava.
    mockDb.teamInvite.findUnique.mockResolvedValue(
      convite({
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );

    await expect(
      createCaller(contexto()).acceptTeamInvite({ inviteId: "inv_1" }),
    ).resolves.toBe(true);

    expect(mockDb.teamUser.createMany).toHaveBeenCalled();
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
