import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes das duas decisões que doem se estiverem erradas: travar cedo demais e
 * excluir uma conta sem aviso. O banco é dublê — o que está sob teste aqui é a
 * regra, não o Prisma.
 */

const db = {
  team: {
    findMany: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  subscription: {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  invoice: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn() },
  dailyEmailUsage: { groupBy: vi.fn().mockResolvedValue([]) },
  session: { findMany: vi.fn().mockResolvedValue([]) },
  planCatalogEntry: { findUnique: vi.fn().mockResolvedValue(null) },
};

vi.mock("~/server/db", () => ({ db }));
vi.mock("~/server/logger/log", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("~/server/service/team-service", () => ({
  TeamService: { refreshTeamCache: vi.fn().mockResolvedValue(null) },
}));

const enviarAvisoDeTrava = vi.fn().mockResolvedValue(undefined);
const enviarAvisoDeInatividade = vi.fn().mockResolvedValue(undefined);
vi.mock("~/server/billing/lifecycle-mailer", () => ({
  enviarAvisoDeTrava: (...args: unknown[]) => enviarAvisoDeTrava(...args),
  enviarAvisoDeInatividade: (...args: unknown[]) =>
    enviarAvisoDeInatividade(...args),
}));

const {
  DIAS_DE_AVISO,
  processarContasInativas,
  travarInadimplentes,
} = await import("./lifecycle-service");

const AGORA = new Date("2026-08-15T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  db.invoice.findMany.mockResolvedValue([]);
  db.team.findMany.mockResolvedValue([]);
  db.dailyEmailUsage.groupBy.mockResolvedValue([]);
  db.session.findMany.mockResolvedValue([]);
});

describe("travarInadimplentes", () => {
  it("procura vencimentos com 24h de carência, não o vencimento cru", async () => {
    await travarInadimplentes(AGORA);

    const filtro = db.invoice.findMany.mock.calls[0]?.[0];
    const corte = filtro.where.dueAt.lt as Date;
    expect(AGORA.getTime() - corte.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("trava, rebaixa a assinatura para past_due e avisa o cliente", async () => {
    db.team.findMany.mockResolvedValue([{ id: 7, name: "Acme" }]);

    const travados = await travarInadimplentes(AGORA);

    expect(travados).toBe(1);
    expect(db.team.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { billingBlockedAt: AGORA },
    });
    expect(db.subscription.updateMany).toHaveBeenCalledWith({
      where: { teamId: 7, status: "active" },
      data: { status: "past_due" },
    });
    expect(enviarAvisoDeTrava).toHaveBeenCalledWith(7);
  });
});

describe("processarContasInativas", () => {
  const seisMesesAtras = new Date("2026-01-01T00:00:00Z");

  it("avisa primeiro e agenda a exclusão para 30 dias depois", async () => {
    db.team.findMany.mockResolvedValue([
      { id: 1, name: "Parada", inactivityWarnedAt: null, inactivityDeleteAt: null },
    ]);
    db.dailyEmailUsage.groupBy.mockResolvedValue([
      { teamId: 1, _max: { date: "2025-12-01" } },
    ]);
    db.team.findMany.mockResolvedValueOnce([
      { id: 1, name: "Parada", inactivityWarnedAt: null, inactivityDeleteAt: null },
    ]);

    const r = await processarContasInativas(AGORA);

    expect(r.avisados).toBe(1);
    expect(r.excluidos).toBe(0);
    expect(db.team.delete).not.toHaveBeenCalled();
    const agendado = db.team.update.mock.calls[0]?.[0].data
      .inactivityDeleteAt as Date;
    expect(
      Math.round((agendado.getTime() - AGORA.getTime()) / 86_400_000),
    ).toBe(DIAS_DE_AVISO);
    expect(enviarAvisoDeInatividade).toHaveBeenCalled();
  });

  it("só exclui depois que o prazo do aviso vence", async () => {
    db.team.findMany.mockResolvedValueOnce([
      {
        id: 2,
        name: "Avisada",
        inactivityWarnedAt: seisMesesAtras,
        inactivityDeleteAt: new Date("2026-08-14T00:00:00Z"),
      },
    ]);
    db.dailyEmailUsage.groupBy.mockResolvedValue([
      { teamId: 2, _max: { date: "2025-01-01" } },
    ]);

    const r = await processarContasInativas(AGORA);

    expect(r.excluidos).toBe(1);
    expect(db.team.delete).toHaveBeenCalledWith({ where: { id: 2 } });
  });

  it("cancela a exclusão quando a conta volta a ser usada", async () => {
    db.team.findMany.mockResolvedValueOnce([
      {
        id: 3,
        name: "Voltou",
        inactivityWarnedAt: seisMesesAtras,
        inactivityDeleteAt: new Date("2026-08-14T00:00:00Z"),
      },
    ]);
    db.dailyEmailUsage.groupBy.mockResolvedValue([
      { teamId: 3, _max: { date: "2026-08-10" } },
    ]);

    const r = await processarContasInativas(AGORA);

    expect(r.recuperados).toBe(1);
    expect(db.team.delete).not.toHaveBeenCalled();
    expect(db.team.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { inactivityWarnedAt: null, inactivityDeleteAt: null },
    });
  });
});
