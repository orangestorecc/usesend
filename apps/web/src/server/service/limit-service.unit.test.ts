import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regressões do controle de bounce (docs-spec/BOUNCE-CONTROL-SPEC.md §2.5 e §7).
 * Os dois testes que não podem quebrar nunca:
 *  - e-mail de sistema atravessa o bloqueio;
 *  - pagamento confirmado não desbloqueia conta com problema de reputação.
 */

const { mockDb, mockTeam } = vi.hoisted(() => ({
  mockDb: {
    teamReputationState: { findUnique: vi.fn() },
    domain: { count: vi.fn() },
    webhook: { count: vi.fn() },
  },
  mockTeam: { getTeamCached: vi.fn() },
}));

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/env", () => ({ env: { NEXT_PUBLIC_IS_CLOUD: true } }));
vi.mock("~/server/logger/log", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("~/server/redis", () => ({
  withCache: (_k: string, fetcher: () => unknown) => fetcher(),
}));
vi.mock("~/server/service/team-service", () => ({ TeamService: mockTeam }));
vi.mock("~/server/service/usage-service", () => ({
  getThisMonthUsage: vi.fn(async () => ({ day: [], month: [] })),
}));

import { LimitService } from "~/server/service/limit-service";
import { LimitReason } from "~/lib/constants/plans";

const timeBase = {
  id: 1,
  plan: "BASIC" as const,
  isActive: true,
  isBlocked: false,
  isVerified: true,
  dailyEmailLimit: 10000,
  sendingBlockedAt: null as Date | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.teamReputationState.findUnique.mockResolvedValue(null);
});

describe("bloqueio por reputação", () => {
  it("barra o envio quando sendingBlockedAt está preenchido", async () => {
    mockTeam.getTeamCached.mockResolvedValue({
      ...timeBase,
      sendingBlockedAt: new Date(),
    });

    const resultado = await LimitService.checkEmailLimit(1);

    expect(resultado.isLimitReached).toBe(true);
    expect(resultado.reason).toBe(LimitReason.EMAIL_BOUNCE_BLOCKED);
  });

  it("continua barrando mesmo com isBlocked=false — pagamento confirmado limpa isBlocked, e isso não pode liberar quem tem problema de bounce", async () => {
    mockTeam.getTeamCached.mockResolvedValue({
      ...timeBase,
      isBlocked: false, // exatamente o que o payment-service grava ao confirmar
      isActive: true,
      plan: "BASIC" as const,
      sendingBlockedAt: new Date(),
    });

    const resultado = await LimitService.checkEmailLimit(1);

    expect(resultado.isLimitReached).toBe(true);
    expect(resultado.reason).toBe(LimitReason.EMAIL_BOUNCE_BLOCKED);
  });

  it("e-mail de sistema atravessa o bloqueio (OTP de login, MFA, aviso de bloqueio)", async () => {
    mockTeam.getTeamCached.mockResolvedValue({
      ...timeBase,
      isBlocked: true,
      sendingBlockedAt: new Date(),
    });

    const resultado = await LimitService.checkEmailLimit(1, {
      isSystemEmail: true,
    });

    expect(resultado.isLimitReached).toBe(false);
    // Nem sequer consulta o time: o caminho de sistema sai antes.
    expect(mockTeam.getTeamCached).not.toHaveBeenCalled();
  });

  it("libera normalmente quando não há bloqueio de reputação", async () => {
    mockTeam.getTeamCached.mockResolvedValue(timeBase);

    const resultado = await LimitService.checkEmailLimit(1);

    expect(resultado.isLimitReached).toBe(false);
  });
});

describe("teto do modo assistido", () => {
  it("aplica o teto reduzido no lugar do limite do plano", async () => {
    mockTeam.getTeamCached.mockResolvedValue(timeBase);
    mockDb.teamReputationState.findUnique.mockResolvedValue({
      state: "SUPERVISED",
      supervisedLimit: 500,
      supervisedUntil: new Date(Date.now() + 86_400_000),
    });

    const resultado = await LimitService.checkEmailLimit(1);

    expect(resultado.limit).toBe(500);
  });

  it("ignora o teto quando a supervisão já venceu", async () => {
    mockTeam.getTeamCached.mockResolvedValue(timeBase);
    mockDb.teamReputationState.findUnique.mockResolvedValue({
      state: "SUPERVISED",
      supervisedLimit: 500,
      supervisedUntil: new Date(Date.now() - 86_400_000),
    });

    const resultado = await LimitService.checkEmailLimit(1);

    expect(resultado.limit).toBe(timeBase.dailyEmailLimit);
  });
});
