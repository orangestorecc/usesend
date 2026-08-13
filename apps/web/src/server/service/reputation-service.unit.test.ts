import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    dailyEmailUsage: { aggregate: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    emailEvent: { findMany: vi.fn() },
    reputationPolicy: { findMany: vi.fn() },
    teamReputationState: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    reputationEvent: { create: vi.fn() },
    team: { update: vi.fn() },
    campaign: { findMany: vi.fn() },
    $transaction: vi.fn(async () => []),
  },
}));

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/server/logger/log", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/server/redis", () => ({
  getRedis: () => ({ set: vi.fn(), get: vi.fn(), del: vi.fn() }),
  redisKey: (k: string) => k,
  withCache: (_k: string, fetcher: () => unknown) => fetcher(),
}));

import {
  ReputationService,
  type ReputationPolicyResolved,
  type ReputationSnapshot,
} from "~/server/service/reputation-service";

const politica: ReputationPolicyResolved = {
  windowDays: 30,
  shortWindowSize: 1000,
  minVolume: 500,
  minBounces: 10,
  warningRate: 0.4,
  criticalRate: 1,
  blockRate: 2,
  unblockRate: 1.2,
  minRecoveryVolume: 200,
  autoBlock: true,
  supervisedLimit: 500,
};

function snapshot(over: Partial<ReputationSnapshot> = {}): ReputationSnapshot {
  const base: ReputationSnapshot = {
    windowDays: 30,
    delivered: 10000,
    hardBounced: 250,
    complained: 5,
    sampleSize: 10250,
    bounceRate: 2.44,
    complaintRate: 0.05,
    shortWindow: {
      size: 1000,
      sampleSize: 1000,
      hardBounced: 25,
      bounceRate: 2.5,
    },
    sampleSufficient: true,
    computedAt: new Date().toISOString(),
  };
  return { ...base, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cálculo da taxa", () => {
  it("usa delivered + hardBounced como denominador", async () => {
    mockDb.reputationPolicy.findMany.mockResolvedValue([
      { teamId: null, ...politica, warningRate: 0.4, criticalRate: 1, blockRate: 2, unblockRate: 1.2 },
    ]);
    mockDb.dailyEmailUsage.aggregate.mockResolvedValue({
      _sum: { delivered: 900, hardBounced: 100, complained: 0 },
    });
    mockDb.emailEvent.findMany.mockResolvedValue([]);

    const resultado = await ReputationService.computeSnapshot(1);

    // 100 / (900 + 100) = 10%, e não 100/900 = 11,1%
    expect(resultado.sampleSize).toBe(1000);
    expect(resultado.bounceRate).toBeCloseTo(10, 5);
  });

  it("não divide por zero quando o time não enviou nada", async () => {
    mockDb.reputationPolicy.findMany.mockResolvedValue([]);
    mockDb.dailyEmailUsage.aggregate.mockResolvedValue({
      _sum: { delivered: null, hardBounced: null, complained: null },
    });
    mockDb.emailEvent.findMany.mockResolvedValue([]);

    const resultado = await ReputationService.computeSnapshot(1);

    expect(resultado.bounceRate).toBe(0);
    expect(resultado.sampleSufficient).toBe(false);
  });

  it("conta só hard bounce na janela curta (soft bounce é transitório)", async () => {
    mockDb.reputationPolicy.findMany.mockResolvedValue([]);
    mockDb.dailyEmailUsage.aggregate.mockResolvedValue({
      _sum: { delivered: 10, hardBounced: 1, complained: 0 },
    });
    mockDb.emailEvent.findMany.mockResolvedValue([
      { status: "DELIVERED", data: {} },
      { status: "DELIVERED", data: {} },
      { status: "BOUNCED", data: { bounceType: "Transient" } },
      { status: "BOUNCED", data: { bounceType: "Permanent" } },
    ]);

    const resultado = await ReputationService.computeSnapshot(1);

    expect(resultado.shortWindow.hardBounced).toBe(1);
    expect(resultado.shortWindow.sampleSize).toBe(3);
  });
});

describe("classificação por faixa", () => {
  it.each([
    [0.2, "HEALTHY"],
    [0.4, "WARNING"],
    [0.9, "WARNING"],
    [1.0, "CRITICAL"],
    [3.0, "CRITICAL"],
  ])("taxa de %s%% cai em %s", (taxa, esperado) => {
    expect(
      ReputationService.classify(snapshot({ bounceRate: taxa as number }), politica),
    ).toBe(esperado);
  });
});

describe("travas anti-falso-positivo do bloqueio", () => {
  it("bloqueia quando as três condições batem", () => {
    expect(ReputationService.shouldBlock(snapshot(), politica)).toBe(true);
  });

  it("não bloqueia com volume insuficiente, mesmo com taxa alta", () => {
    // 9 retornos em 300 entregas = 3%, mas amostra pequena demais.
    const pequeno = snapshot({
      delivered: 291,
      hardBounced: 9,
      sampleSize: 300,
      bounceRate: 3,
      sampleSufficient: false,
    });
    expect(ReputationService.shouldBlock(pequeno, politica)).toBe(false);
  });

  it("não bloqueia quando a janela curta já se recuperou", () => {
    // O pico é resíduo de dias atrás; hoje a conta está saudável.
    const residual = snapshot({
      shortWindow: { size: 1000, sampleSize: 1000, hardBounced: 3, bounceRate: 0.3 },
    });
    expect(ReputationService.shouldBlock(residual, politica)).toBe(false);
  });
});

describe("histerese do desbloqueio", () => {
  it("não desbloqueia entre unblockRate e blockRate (evita flapping)", () => {
    const meio = snapshot({
      bounceRate: 1.5,
      shortWindow: { size: 1000, sampleSize: 1000, hardBounced: 15, bounceRate: 1.5 },
      sampleSize: 10250,
    });
    expect(ReputationService.canUnblock(meio, politica, 10000)).toBe(false);
  });

  it("não desbloqueia sem volume novo, mesmo com taxa baixa", () => {
    // A taxa caiu só por decaimento da janela: nenhuma entrega nova desde o bloqueio.
    const semVolume = snapshot({
      bounceRate: 0.5,
      shortWindow: { size: 1000, sampleSize: 1000, hardBounced: 5, bounceRate: 0.5 },
      sampleSize: 10250,
    });
    expect(ReputationService.canUnblock(semVolume, politica, 10250)).toBe(false);
  });

  it("desbloqueia com taxa abaixo da histerese e volume novo suficiente", () => {
    const recuperado = snapshot({
      bounceRate: 0.8,
      shortWindow: { size: 1000, sampleSize: 1000, hardBounced: 8, bounceRate: 0.8 },
      sampleSize: 10250,
    });
    expect(ReputationService.canUnblock(recuperado, politica, 10000)).toBe(true);
  });
});
