import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockSendTeamInviteEmail, mockCheckTeamMemberLimit } = vi.hoisted(
  () => ({
    mockDb: {
      teamUser: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      teamInvite: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    },
    mockSendTeamInviteEmail: vi.fn(),
    mockCheckTeamMemberLimit: vi.fn(),
  }),
);

vi.mock("~/server/service/limit-service", () => ({
  LimitService: { checkTeamMemberLimit: mockCheckTeamMemberLimit },
}));

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

vi.mock("~/server/auth", () => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock("~/server/mailer", () => ({
  sendMail: vi.fn(),
  sendTeamInviteEmail: mockSendTeamInviteEmail,
}));

vi.mock("~/server/service/webhook-service", () => ({}));

import { createCallerFactory } from "~/server/api/trpc";
import { teamRouter } from "~/server/api/routers/team";
import { conviteExpirado } from "~/lib/invites";

const createCaller = createCallerFactory(teamRouter);

function getContext() {
  return {
    db: mockDb,
    headers: new Headers(),
    session: {
      user: {
        id: 1,
        email: "admin@example.com",
        isWaitlisted: false,
        isAdmin: false,
        isBetaUser: true,
      },
    },
  } as any;
}

describe("teamRouter.resendTeamInvite authorization", () => {
  beforeEach(() => {
    mockDb.teamUser.findFirst.mockReset();
    mockDb.teamInvite.findFirst.mockReset();
    mockSendTeamInviteEmail.mockReset();

    mockDb.teamUser.findFirst.mockResolvedValue({
      teamId: 1,
      userId: 1,
      role: "ADMIN",
      team: { id: 1, name: "Team One" },
    });
  });

  it("does not resend invites that belong to another team", async () => {
    mockDb.teamInvite.findFirst.mockResolvedValue(null);

    const caller = createCaller(getContext());

    await expect(
      caller.resendTeamInvite({ inviteId: "invite_team_2" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Convite não encontrado",
    });

    expect(mockDb.teamInvite.findFirst).toHaveBeenCalledWith({
      where: {
        teamId: 1,
        id: {
          equals: "invite_team_2",
        },
      },
    });

    expect(mockSendTeamInviteEmail).not.toHaveBeenCalled();
  });
});

describe("teamRouter.resendTeamInvite renova o prazo", () => {
  const OITO_DIAS_ATRAS = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    mockDb.teamUser.findFirst.mockReset();
    mockDb.teamInvite.findFirst.mockReset();
    mockDb.teamInvite.update.mockReset();
    mockSendTeamInviteEmail.mockReset();

    mockDb.teamUser.findFirst.mockResolvedValue({
      teamId: 1,
      userId: 1,
      role: "ADMIN",
      team: { id: 1, name: "Team One" },
    });
    // Convite já vencido: é exatamente quando o admin clica em "Reenviar".
    mockDb.teamInvite.findFirst.mockResolvedValue({
      id: "inv_1",
      teamId: 1,
      email: "convidado@example.com",
      role: "MEMBER",
      createdAt: OITO_DIAS_ATRAS,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
  });

  it("empurra expiresAt para 7 dias à frente ao reenviar convite expirado", async () => {
    const antes = Date.now();
    mockDb.teamInvite.update.mockImplementation(async ({ data }: any) => ({
      id: "inv_1",
      expiresAt: data.expiresAt,
    }));

    const resultado = await createCaller(getContext()).resendTeamInvite({
      inviteId: "inv_1",
    });

    expect(mockSendTeamInviteEmail).toHaveBeenCalled();
    expect(mockDb.teamInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv_1" } }),
    );

    const novoPrazo = (resultado as { expiresAt: Date }).expiresAt.getTime();
    // Vale mesmo por ~7 dias a partir de agora, como o toast promete.
    expect(novoPrazo).toBeGreaterThan(antes + 6.9 * 24 * 60 * 60 * 1000);
    expect(novoPrazo).toBeLessThan(Date.now() + 7.1 * 24 * 60 * 60 * 1000);
    // E o convite deixa de estar expirado para o aceite.
    expect(conviteExpirado({ expiresAt: new Date(novoPrazo) })).toBe(false);
  });

  it("não renova o prazo se o e-mail não saiu", async () => {
    mockSendTeamInviteEmail.mockRejectedValue(new Error("smtp fora do ar"));

    await expect(
      createCaller(getContext()).resendTeamInvite({ inviteId: "inv_1" }),
    ).rejects.toThrow();

    expect(mockDb.teamInvite.update).not.toHaveBeenCalled();
  });
});

describe("teamRouter.createTeamInvite com multi-workspace", () => {
  beforeEach(() => {
    mockDb.teamUser.findFirst.mockReset();
    mockDb.user.findUnique.mockReset();
    mockDb.teamInvite.create.mockReset();
    mockSendTeamInviteEmail.mockReset();

    mockDb.teamUser.findFirst.mockResolvedValue({
      teamId: 1,
      userId: 1,
      role: "ADMIN",
      team: { id: 1, name: "Team One" },
    });
    mockCheckTeamMemberLimit.mockResolvedValue({ isLimitReached: false });
    mockDb.teamInvite.create.mockResolvedValue({ id: "inv_1" });
  });

  it("recusa convidar quem já está NESTE time", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: 9,
      teamUsers: [{ teamId: 1, userId: 9 }],
    });

    await expect(
      createCaller(getContext()).createTeamInvite({
        email: "ja@example.com",
        role: "MEMBER",
        sendEmail: false,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Este usuário já faz parte deste workspace",
    });

    expect(mockDb.teamInvite.create).not.toHaveBeenCalled();
  });

  it("permite convidar quem já está em OUTRO time", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: 9,
      teamUsers: [{ teamId: 2, userId: 9 }],
    });

    await expect(
      createCaller(getContext()).createTeamInvite({
        email: "outro@example.com",
        role: "MEMBER",
        sendEmail: false,
      }),
    ).resolves.toMatchObject({ id: "inv_1" });

    expect(mockDb.teamInvite.create).toHaveBeenCalled();
  });
});
