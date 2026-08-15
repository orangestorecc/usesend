import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    teamUser: { findFirst: vi.fn() },
    session: { findUnique: vi.fn() },
  },
}));

vi.mock("~/server/db", () => ({ db: mockDb }));

import {
  WORKSPACE_COOKIE,
  lerTravaDeLinkDeAcesso,
  resolverTimeAtivo,
} from "~/server/service/active-team";

const TIME_A = { teamId: 1, userId: 7, role: "MEMBER", team: { id: 1 } };
const TIME_B = { teamId: 2, userId: 7, role: "ADMIN", team: { id: 2 } };

function headers(cookie: string) {
  return new Headers({ cookie });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.session.findUnique.mockResolvedValue({ accessLinkTeamId: null });
  mockDb.teamUser.findFirst.mockImplementation(async ({ where }: any) => {
    if (where.teamId === 1) return TIME_A;
    if (where.teamId === 2) return TIME_B;
    return TIME_A;
  });
});

describe("resolverTimeAtivo", () => {
  it("usa o cookie de workspace numa sessão normal", async () => {
    const time = await resolverTimeAtivo(
      7,
      headers(`next-auth.session-token=abc; ${WORKSPACE_COOKIE}=2`),
    );

    expect(time).toBe(TIME_B);
  });

  it("sessão de link de acesso fica presa ao time emissor, cookie ignorado", async () => {
    // X é MEMBER do time A (emissor) e ADMIN do time B. O cookie aponta para o
    // time B; a trava tem que vencer.
    mockDb.session.findUnique.mockResolvedValue({ accessLinkTeamId: 1 });

    const time = await resolverTimeAtivo(
      7,
      headers(`next-auth.session-token=abc; ${WORKSPACE_COOKIE}=2`),
    );

    expect(time).toBe(TIME_A);
    const [{ where }] = mockDb.teamUser.findFirst.mock.calls[0]!;
    expect(where).toEqual({ userId: 7, teamId: 1 });
    // Uma só consulta: nada de fallback que reabra a porta do time B.
    expect(mockDb.teamUser.findFirst).toHaveBeenCalledTimes(1);
  });

  it("sessão presa a um time do qual a pessoa saiu não cai em fallback", async () => {
    mockDb.session.findUnique.mockResolvedValue({ accessLinkTeamId: 1 });
    mockDb.teamUser.findFirst.mockResolvedValue(null);

    expect(
      await resolverTimeAtivo(7, headers("next-auth.session-token=abc")),
    ).toBeNull();
  });
});

describe("lerTravaDeLinkDeAcesso", () => {
  it("lê o sinal da row de Session, não de cookie forjável", async () => {
    mockDb.session.findUnique.mockResolvedValue({ accessLinkTeamId: 9 });

    expect(
      await lerTravaDeLinkDeAcesso(headers("next-auth.session-token=abc")),
    ).toBe(9);
    expect(mockDb.session.findUnique).toHaveBeenCalledWith({
      where: { sessionToken: "abc" },
      select: { accessLinkTeamId: true },
    });
  });

  it("sem cookie de sessão não há trava e nem consulta ao banco", async () => {
    expect(await lerTravaDeLinkDeAcesso(new Headers())).toBeNull();
    expect(mockDb.session.findUnique).not.toHaveBeenCalled();
  });
});
