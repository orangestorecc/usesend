import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDb,
  mockLogger,
  mockAddOrUpdateContact,
  mockStartRun,
  mockQueueRunStep,
} = vi.hoisted(() => ({
  mockDb: {
    customEvent: {
      create: vi.fn(),
    },
    automation: {
      findMany: vi.fn(),
    },
    automationRun: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  mockLogger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  mockAddOrUpdateContact: vi.fn(),
  mockStartRun: vi.fn(),
  mockQueueRunStep: vi.fn(),
}));

vi.mock("../db", () => ({
  db: mockDb,
}));

vi.mock("../logger/log", () => ({
  logger: mockLogger,
}));

vi.mock("./contact-service", () => ({
  addOrUpdateContact: mockAddOrUpdateContact,
}));

vi.mock("./automation-service", () => ({
  AutomationEngineService: {
    startRun: mockStartRun,
  },
  AutomationRunQueueService: {
    queueRunStep: mockQueueRunStep,
  },
}));

import { AutomationEventService } from "./automation-event-service";

const contact = {
  id: "contact_1",
  email: "alice@example.com",
  contactBookId: "book_1",
};

function makeAutomation(overrides: Record<string, unknown> = {}) {
  return {
    id: "automation_1",
    teamId: 1,
    status: "ENABLED",
    triggerEventName: "order.paid",
    steps: {},
    connections: [],
    ...overrides,
  };
}

describe("AutomationEventService.recordAndDispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.customEvent.create.mockResolvedValue({ id: "event_1" });
    mockDb.automation.findMany.mockResolvedValue([]);
    mockDb.automationRun.findMany.mockResolvedValue([]);
  });

  it("starts a new run for each ENABLED automation matching the trigger event name", async () => {
    const automation = makeAutomation();
    mockDb.automation.findMany.mockResolvedValue([automation]);

    await AutomationEventService.recordAndDispatch(1, {
      name: "order.paid",
      contact: contact as any,
      payload: { orderId: "o1" },
    });

    expect(mockDb.automation.findMany).toHaveBeenCalledWith({
      where: { teamId: 1, status: "ENABLED", triggerEventName: "order.paid" },
    });
    expect(mockStartRun).toHaveBeenCalledWith(automation, contact, {
      event: { name: "order.paid", payload: { orderId: "o1" } },
    });
  });

  it("does not start a run for DISABLED or DRAFT automations", async () => {
    // triggerNewAutomations queries with status: "ENABLED" directly in the
    // where clause, so DISABLED/DRAFT automations are excluded by the DB
    // query itself and never returned here.
    mockDb.automation.findMany.mockResolvedValue([]);

    await AutomationEventService.recordAndDispatch(1, {
      name: "order.paid",
      contact: contact as any,
    });

    expect(mockDb.automation.findMany).toHaveBeenCalledWith({
      where: { teamId: 1, status: "ENABLED", triggerEventName: "order.paid" },
    });
    expect(mockStartRun).not.toHaveBeenCalled();
  });

  it("resumes a WAITING run whose waitingForEvent matches the dispatched event", async () => {
    const waitingRun = {
      id: "run_1",
      teamId: 1,
      contactId: "contact_1",
      status: "WAITING",
      waitingForEvent: "order.shipped",
      currentStepKey: "wait_step",
      context: { event: { name: "order.paid", payload: {} } },
      automation: {
        connections: [{ from: "wait_step", to: "next_step" }],
      },
    };
    mockDb.automationRun.findMany.mockResolvedValue([waitingRun]);

    await AutomationEventService.recordAndDispatch(1, {
      name: "order.shipped",
      contact: contact as any,
      payload: { trackingId: "t1" },
    });

    expect(mockDb.automationRun.findMany).toHaveBeenCalledWith({
      where: {
        teamId: 1,
        contactId: "contact_1",
        status: "WAITING",
        waitingForEvent: "order.shipped",
      },
      include: { automation: true },
    });
    expect(mockDb.automationRun.update).toHaveBeenCalledWith({
      where: { id: "run_1" },
      data: {
        status: "RUNNING",
        waitingForEvent: null,
        resumeAt: null,
        currentStepKey: "next_step",
        context: {
          event: {
            name: "order.shipped",
            payload: { trackingId: "t1" },
          },
        },
      },
    });
    expect(mockQueueRunStep).toHaveBeenCalledWith({ runId: "run_1" });
  });

  it("does not touch runs waiting on a different event name", async () => {
    // resumeWaitingRuns queries with waitingForEvent: name directly, so a
    // run waiting on a different event name is excluded by the DB query.
    mockDb.automationRun.findMany.mockResolvedValue([]);

    await AutomationEventService.recordAndDispatch(1, {
      name: "order.paid",
      contact: contact as any,
    });

    expect(mockDb.automationRun.findMany).toHaveBeenCalledWith({
      where: {
        teamId: 1,
        contactId: "contact_1",
        status: "WAITING",
        waitingForEvent: "order.paid",
      },
      include: { automation: true },
    });
    expect(mockDb.automationRun.update).not.toHaveBeenCalled();
    expect(mockQueueRunStep).not.toHaveBeenCalled();
  });

  it("does not touch runs waiting for the same event but belonging to a different contact", async () => {
    // The findMany where clause scopes by contactId: contact.id, so a run
    // for a different contact is never returned even if it's waiting on the
    // same event name.
    mockDb.automationRun.findMany.mockResolvedValue([]);

    await AutomationEventService.recordAndDispatch(1, {
      name: "order.paid",
      contact: contact as any,
    });

    expect(mockDb.automationRun.findMany).toHaveBeenCalledWith({
      where: {
        teamId: 1,
        contactId: "contact_1",
        status: "WAITING",
        waitingForEvent: "order.paid",
      },
      include: { automation: true },
    });
    expect(mockDb.automationRun.update).not.toHaveBeenCalled();
  });

  it("records the custom event regardless of whether any automation matches", async () => {
    await AutomationEventService.recordAndDispatch(1, {
      name: "order.paid",
      contact: contact as any,
      payload: { orderId: "o1" },
    });

    expect(mockDb.customEvent.create).toHaveBeenCalledWith({
      data: {
        teamId: 1,
        name: "order.paid",
        contactId: "contact_1",
        payload: { orderId: "o1" },
      },
    });
  });
});
