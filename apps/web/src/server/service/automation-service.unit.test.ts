import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDb,
  mockLogger,
  mockValidateDomainFromEmail,
  mockQueueEmail,
  mockUpdateContactInContactBook,
  mockDeleteContactInContactBook,
  mockBuildContactWhere,
  handlerBox,
} = vi.hoisted(() => ({
  mockDb: {
    automationRun: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    automationStepRun: {
      create: vi.fn(),
    },
    segment: {
      findFirst: vi.fn(),
    },
  },
  mockLogger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  mockValidateDomainFromEmail: vi.fn(),
  mockQueueEmail: vi.fn(),
  mockUpdateContactInContactBook: vi.fn(),
  mockDeleteContactInContactBook: vi.fn(),
  mockBuildContactWhere: vi.fn(),
  // Captures the handler passed to `new Worker(name, handler, opts)` so
  // tests can invoke the run-execution logic (executeRun) directly, since
  // it isn't exported by the source module.
  handlerBox: { current: undefined as ((job: any) => Promise<void>) | undefined },
}));

vi.mock("../db", () => ({
  db: mockDb,
}));

vi.mock("../logger/log", () => ({
  logger: mockLogger,
}));

vi.mock("./domain-service", () => ({
  validateDomainFromEmail: mockValidateDomainFromEmail,
}));

vi.mock("./email-queue-service", () => ({
  EmailQueueService: {
    queueEmail: mockQueueEmail,
  },
}));

vi.mock("./contact-service", () => ({
  updateContactInContactBook: mockUpdateContactInContactBook,
  deleteContactInContactBook: mockDeleteContactInContactBook,
}));

vi.mock("./segment-service", () => ({
  buildContactWhere: mockBuildContactWhere,
}));

vi.mock("../redis", () => ({
  getRedis: vi.fn(),
  BULL_PREFIX: "test",
}));

vi.mock("../queue/queue-constants", () => ({
  AUTOMATION_RUN_QUEUE: "automation-run",
  DEFAULT_QUEUE_OPTIONS: {},
}));

vi.mock("../queue/bullmq-context", () => ({
  createWorkerHandler: (fn: any) => fn,
}));

vi.mock("bullmq", () => {
  class Queue {
    add = vi.fn();
  }
  class Worker {
    constructor(_name: string, handler: any) {
      handlerBox.current = handler;
    }
  }
  return { Queue, Worker };
});

import { AutomationRunQueueService } from "./automation-service";

async function executeRunForTest(runId: string) {
  if (!handlerBox.current) {
    throw new Error("Worker handler not captured");
  }
  await handlerBox.current({ data: { runId } } as any);
}

const baseContact = {
  id: "contact_1",
  email: "alice@example.com",
  contactBookId: "book_1",
  properties: {},
};

function makeAutomation(steps: any, connections: any) {
  return {
    id: "automation_1",
    teamId: 1,
    steps,
    connections,
  };
}

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run_1",
    automationId: "automation_1",
    teamId: 1,
    contactId: "contact_1",
    currentStepKey: "trigger",
    status: "RUNNING",
    context: {},
    contact: baseContact,
    automation: makeAutomation(
      { trigger: { type: "trigger", config: {} } },
      [],
    ),
    ...overrides,
  };
}

describe("automation-service executeRun", () => {
  let queueRunStepSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queueRunStepSpy = vi
      .spyOn(AutomationRunQueueService, "queueRunStep")
      .mockResolvedValue(undefined) as unknown as ReturnType<typeof vi.spyOn>;
  });

  it("branches to the true edge when the condition matches", async () => {
    const steps = {
      trigger: { type: "trigger", config: {} },
      cond: {
        type: "condition",
        config: { rules: { match: "all", conditions: [] } },
      },
      true_step: { type: "trigger", config: {} },
      false_step: { type: "trigger", config: {} },
    };
    const connections = [
      { from: "trigger", to: "cond" },
      { from: "cond", to: "true_step", condition: "true" },
      { from: "cond", to: "false_step", condition: "false" },
    ];

    const run = makeRun({
      currentStepKey: "cond",
      automation: makeAutomation(steps, connections),
    });

    mockDb.automationRun.findUnique.mockResolvedValueOnce(run);
    mockDb.automationRun.update.mockImplementation(async ({ data }: any) => ({
      ...run,
      currentStepKey: data.currentStepKey,
    }));

    await executeRunForTest("run_1");

    expect(mockDb.automationRun.update).toHaveBeenNthCalledWith(1, {
      where: { id: "run_1" },
      data: { currentStepKey: "true_step" },
      include: { automation: true, contact: true },
    });
  });

  it("branches to the false edge when the condition does not match", async () => {
    const steps = {
      trigger: { type: "trigger", config: {} },
      cond: {
        type: "condition",
        config: {
          rules: {
            match: "all",
            conditions: [{ field: "email", op: "eq", value: "nope" }],
          },
        },
      },
      true_step: { type: "trigger", config: {} },
      false_step: { type: "trigger", config: {} },
    };
    const connections = [
      { from: "trigger", to: "cond" },
      { from: "cond", to: "true_step", condition: "true" },
      { from: "cond", to: "false_step", condition: "false" },
    ];

    const run = makeRun({
      currentStepKey: "cond",
      automation: makeAutomation(steps, connections),
    });

    mockDb.automationRun.findUnique.mockResolvedValueOnce(run);
    mockDb.automationRun.update.mockImplementation(async ({ data }: any) => ({
      ...run,
      currentStepKey: data.currentStepKey,
    }));

    await executeRunForTest("run_1");

    expect(mockDb.automationRun.update).toHaveBeenNthCalledWith(1, {
      where: { id: "run_1" },
      data: { currentStepKey: "false_step" },
      include: { automation: true, contact: true },
    });
  });

  it("delay step sets WAITING with resumeAt computed from durationMs and clears waitingForEvent", async () => {
    const steps = {
      trigger: { type: "trigger", config: {} },
      delay_step: { type: "delay", config: { durationMs: 60_000 } },
    };
    const connections = [{ from: "trigger", to: "delay_step" }];

    const run = makeRun({
      currentStepKey: "delay_step",
      automation: makeAutomation(steps, connections),
    });

    mockDb.automationRun.findUnique.mockResolvedValueOnce(run);
    mockDb.automationRun.update.mockResolvedValueOnce(run);

    const before = Date.now();
    await executeRunForTest("run_1");
    const after = Date.now();

    expect(mockDb.automationRun.update).toHaveBeenCalledWith({
      where: { id: "run_1" },
      data: {
        status: "WAITING",
        resumeAt: expect.any(Date),
        waitingForEvent: null,
      },
    });
    const call = mockDb.automationRun.update.mock.calls[0]![0];
    const resumeAtMs = call.data.resumeAt.getTime();
    expect(resumeAtMs).toBeGreaterThanOrEqual(before + 60_000);
    expect(resumeAtMs).toBeLessThanOrEqual(after + 60_000);
  });

  it("wait_for_event step sets WAITING with waitingForEvent set to the awaited event name", async () => {
    const steps = {
      trigger: { type: "trigger", config: {} },
      wait_step: {
        type: "wait_for_event",
        config: { eventName: "order.paid" },
      },
    };
    const connections = [{ from: "trigger", to: "wait_step" }];

    const run = makeRun({
      currentStepKey: "wait_step",
      automation: makeAutomation(steps, connections),
    });

    mockDb.automationRun.findUnique.mockResolvedValueOnce(run);
    mockDb.automationRun.update.mockResolvedValueOnce(run);

    await executeRunForTest("run_1");

    expect(mockDb.automationRun.update).toHaveBeenCalledWith({
      where: { id: "run_1" },
      data: {
        status: "WAITING",
        resumeAt: null,
        waitingForEvent: "order.paid",
      },
    });
  });

  it("re-enqueues via queueRunStep instead of looping forever once the 25-step safety cap is hit", async () => {
    const steps: Record<string, any> = {};
    const connections: any[] = [];
    for (let i = 0; i < 30; i++) {
      steps[`s${i}`] = { type: "trigger", config: {} };
      if (i < 29) connections.push({ from: `s${i}`, to: `s${i + 1}` });
    }

    const automation = makeAutomation(steps, connections);
    const run = makeRun({ currentStepKey: "s0", automation });

    mockDb.automationRun.findUnique.mockResolvedValueOnce(run);
    mockDb.automationRun.update.mockImplementation(async ({ data }: any) => ({
      ...run,
      status: "RUNNING",
      currentStepKey: data.currentStepKey,
      automation,
    }));

    await executeRunForTest("run_1");

    // MAX_STEPS_PER_INVOCATION = 25: exactly 25 update calls happen before
    // the loop bails out and re-enqueues a fresh job instead of continuing.
    expect(mockDb.automationRun.update).toHaveBeenCalledTimes(25);
    expect(queueRunStepSpy).toHaveBeenCalledWith({ runId: "run_1" });
  });

  it("marks the run FAILED and records the failing AutomationStepRun when a step throws", async () => {
    const steps = {
      trigger: { type: "trigger", config: {} },
      segment_step: {
        type: "add_to_segment",
        config: { segmentId: "missing_segment" },
      },
    };
    const connections = [{ from: "trigger", to: "segment_step" }];

    const run = makeRun({
      currentStepKey: "segment_step",
      automation: makeAutomation(steps, connections),
    });

    mockDb.automationRun.findUnique.mockResolvedValueOnce(run);
    mockDb.segment.findFirst.mockResolvedValueOnce(null);

    await executeRunForTest("run_1");

    expect(mockDb.automationStepRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        runId: "run_1",
        stepKey: "segment_step",
        status: "failed",
        error: expect.stringContaining("Segment"),
      }),
    });
    expect(mockDb.automationRun.update).toHaveBeenCalledWith({
      where: { id: "run_1" },
      data: { status: "FAILED", error: expect.stringContaining("Segment") },
    });
    expect(mockBuildContactWhere).not.toHaveBeenCalled();
  });
});
