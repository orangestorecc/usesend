import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    teamUser: {
      findFirst: vi.fn(),
    },
    automation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    automationRun: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

vi.mock("~/server/auth", () => ({
  getServerAuthSession: vi.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { automationRouter } from "~/server/api/routers/automation";

const createCaller = createCallerFactory(automationRouter);

function getContext() {
  return {
    db: mockDb,
    headers: new Headers(),
    session: {
      user: {
        id: 1,
        email: "owner@example.com",
        isWaitlisted: false,
        isAdmin: false,
        isBetaUser: true,
      },
    },
  } as any;
}

function mockTeam(teamId = 10) {
  mockDb.teamUser.findFirst.mockResolvedValue({
    teamId,
    userId: 1,
    role: "ADMIN",
    team: { id: teamId, name: "Acme" },
  });
}

beforeEach(() => {
  mockDb.teamUser.findFirst.mockReset();
  mockDb.automation.findFirst.mockReset();
  mockDb.automation.findMany.mockReset();
  mockDb.automation.create.mockReset();
  mockDb.automation.update.mockReset();
  mockDb.automation.delete.mockReset();
  mockDb.automationRun.findFirst.mockReset();
  mockDb.automationRun.findMany.mockReset();
  mockTeam();
});

describe("automationRouter.update", () => {
  it("throws FORBIDDEN when the automation status is ENABLED", async () => {
    mockDb.automation.findFirst.mockResolvedValue({
      id: "auto_1",
      teamId: 10,
      status: "ENABLED",
    });

    const caller = createCaller(getContext());

    await expect(
      caller.update({ id: "auto_1", name: "New name" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Cannot edit an automation while it is enabled",
    });

    expect(mockDb.automation.update).not.toHaveBeenCalled();
  });

  it("allows editing a DRAFT automation", async () => {
    mockDb.automation.findFirst.mockResolvedValue({
      id: "auto_1",
      teamId: 10,
      status: "DRAFT",
    });
    mockDb.automation.update.mockResolvedValue({
      id: "auto_1",
      teamId: 10,
      status: "DRAFT",
      name: "New name",
    });

    const caller = createCaller(getContext());

    await caller.update({ id: "auto_1", name: "New name" });

    expect(mockDb.automation.update).toHaveBeenCalledWith({
      where: { id: "auto_1" },
      data: { name: "New name" },
    });
  });
});

describe("automationRouter.enable", () => {
  it("throws BAD_REQUEST when there is no trigger-connected step", async () => {
    mockDb.automation.findFirst.mockResolvedValue({
      id: "auto_1",
      teamId: 10,
      status: "DRAFT",
      steps: { trigger: { type: "trigger", config: {} } },
      connections: [],
    });

    const caller = createCaller(getContext());

    await expect(caller.enable({ id: "auto_1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "The automation needs a trigger connected to at least one step before it can be enabled",
    });

    expect(mockDb.automation.update).not.toHaveBeenCalled();
  });

  it("enables an automation whose trigger is connected to a step", async () => {
    mockDb.automation.findFirst.mockResolvedValue({
      id: "auto_1",
      teamId: 10,
      status: "DRAFT",
      steps: {
        trigger: { type: "trigger", config: {} },
        step_1: { type: "send_email", config: {} },
      },
      connections: [{ from: "trigger", to: "step_1" }],
    });
    mockDb.automation.update.mockResolvedValue({
      id: "auto_1",
      teamId: 10,
      status: "ENABLED",
    });

    const caller = createCaller(getContext());

    const result = await caller.enable({ id: "auto_1" });

    expect(mockDb.automation.update).toHaveBeenCalledWith({
      where: { id: "auto_1" },
      data: { status: "ENABLED" },
    });
    expect(result.status).toBe("ENABLED");
  });
});

describe("automationRouter team scoping", () => {
  it("list only queries automations scoped to the caller's team", async () => {
    mockDb.automation.findMany.mockResolvedValue([]);

    const caller = createCaller(getContext());
    await caller.list();

    expect(mockDb.automation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId: 10 } }),
    );
  });

  it("get does not return an automation belonging to another team", async () => {
    // findFirst is scoped by teamId: team.id in the where clause, so an
    // automation belonging to another team is never matched and findFirst
    // resolves to null (as Prisma would for a real cross-team lookup).
    mockDb.automation.findFirst.mockResolvedValue(null);

    const caller = createCaller(getContext());

    await expect(caller.get({ id: "auto_other_team" })).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
        message: "Automation not found",
      },
    );

    expect(mockDb.automation.findFirst).toHaveBeenCalledWith({
      where: { id: "auto_other_team", teamId: 10 },
    });
  });

  it("delete does not delete an automation belonging to another team", async () => {
    mockDb.automation.findFirst.mockResolvedValue(null);

    const caller = createCaller(getContext());

    await expect(
      caller.delete({ id: "auto_other_team" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Automation not found",
    });

    expect(mockDb.automation.findFirst).toHaveBeenCalledWith({
      where: { id: "auto_other_team", teamId: 10 },
    });
    expect(mockDb.automation.delete).not.toHaveBeenCalled();
  });

  it("delete removes an automation that belongs to the caller's team", async () => {
    mockDb.automation.findFirst.mockResolvedValue({
      id: "auto_1",
      teamId: 10,
    });
    mockDb.automation.delete.mockResolvedValue({ id: "auto_1" });

    const caller = createCaller(getContext());

    const result = await caller.delete({ id: "auto_1" });

    expect(mockDb.automation.delete).toHaveBeenCalledWith({
      where: { id: "auto_1" },
    });
    expect(result).toEqual({ ok: true });
  });
});
