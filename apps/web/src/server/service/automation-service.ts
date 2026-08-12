import { Queue, Worker } from "bullmq";
import { Automation, AutomationRun, Contact, Prisma } from "@prisma/client";
import { db } from "../db";
import { getRedis, BULL_PREFIX } from "../redis";
import {
  AUTOMATION_RUN_QUEUE,
  DEFAULT_QUEUE_OPTIONS,
} from "../queue/queue-constants";
import { createWorkerHandler, TeamJob } from "../queue/bullmq-context";
import { logger } from "../logger/log";
import { EmailQueueService } from "./email-queue-service";
import { validateDomainFromEmail } from "./domain-service";
import {
  BUILT_IN_CONTACT_VARIABLES,
  replaceContactVariables,
} from "../utils/contact-variable-replacement";
import {
  updateContactInContactBook,
  deleteContactInContactBook,
} from "./contact-service";
import { buildContactWhere, SegmentRules } from "./segment-service";

// ---------------------------------------------------------------------------
// Shape of Automation.steps / Automation.connections (both stored as Json)
// ---------------------------------------------------------------------------
//
// steps: Record<stepKey, AutomationStepDefinition>
//   {
//     "trigger": { "type": "trigger", "config": {} },
//     "step_1": {
//       "type": "send_email",
//       "config": { "subject": "Hi {{firstName}}", "from": "a@b.com", "html": "<p>{{event.orderId}}</p>" }
//     }
//   }
//
// connections: AutomationConnection[]
//   [{ "from": "trigger", "to": "step_1" }]
//   Condition branches use `condition: "true" | "false"` on the edge leaving
//   a `condition` step. A `wait_for_event` step that times out looks for an
//   outgoing edge with `condition: "timeout"`; if absent, the run just
//   completes (see automation-scheduler-job.ts).

export type AutomationStepType =
  | "trigger"
  | "send_email"
  | "condition"
  | "delay"
  | "wait_for_event"
  | "update_contact"
  | "delete_contact"
  | "add_to_segment";

export type AutomationStepDefinition = {
  type: AutomationStepType;
  config: Record<string, unknown>;
};

export type AutomationSteps = Record<string, AutomationStepDefinition>;

export type AutomationConnection = {
  from: string;
  to: string;
  condition?: "true" | "false" | "timeout";
};

const MAX_STEPS_PER_INVOCATION = 25;

type AutomationRunJob = TeamJob<{ runId: string }>;

function getSteps(automation: Automation): AutomationSteps {
  return (automation.steps ?? {}) as unknown as AutomationSteps;
}

function getConnections(automation: Automation): AutomationConnection[] {
  return (automation.connections ?? []) as unknown as AutomationConnection[];
}

function findNextStepKey(
  connections: AutomationConnection[],
  fromKey: string,
  condition?: "true" | "false" | "timeout",
): string | undefined {
  if (condition) {
    const match = connections.find(
      (c) => c.from === fromKey && c.condition === condition,
    );
    if (match) return match.to;
  }

  const plain = connections.find((c) => c.from === fromKey && !c.condition);
  return plain?.to;
}

function substituteEventVariables(
  value: string,
  context: Record<string, unknown>,
): string {
  const event = (context?.event ?? {}) as { payload?: Record<string, unknown> };
  const payload = event.payload ?? {};

  return value.replace(/\{\{\s*event\.([a-zA-Z0-9_]+)\s*\}\}/gi, (match, key) => {
    const val = payload[key];
    if (val === undefined || val === null) return "";
    return String(val);
  });
}

function evaluateConditionRules(
  rules: SegmentRules,
  contact: Contact,
  context: Record<string, unknown>,
): boolean {
  // Reuse the Segment rule shape/evaluator: build a Prisma where clause and
  // check it against the in-memory contact + event payload instead of
  // hitting the DB (the run already has the contact loaded).
  const conditions = rules?.conditions ?? [];
  if (conditions.length === 0) return true;

  const event = (context?.event ?? {}) as { payload?: Record<string, unknown> };
  const payload = event.payload ?? {};

  const results = conditions.map((cond) => {
    const { field, op, value } = cond;
    let actual: unknown;

    if (field.startsWith("properties.")) {
      const key = field.slice("properties.".length);
      actual = (contact.properties as Record<string, unknown> | null)?.[key];
    } else if (field.startsWith("event.")) {
      const key = field.slice("event.".length);
      actual = payload[key];
    } else {
      actual = (contact as unknown as Record<string, unknown>)[field];
    }

    switch (op) {
      case "eq":
        return actual === value;
      case "neq":
        return actual !== value;
      case "contains":
        return typeof actual === "string" && actual.includes(String(value));
      case "in":
        return Array.isArray(value) && value.includes(actual);
      default:
        return false;
    }
  });

  return rules.match === "any"
    ? results.some(Boolean)
    : results.every(Boolean);
}

async function recordStepRun({
  runId,
  stepKey,
  status,
  output,
  error,
}: {
  runId: string;
  stepKey: string;
  status: "completed" | "failed";
  output?: Prisma.InputJsonValue;
  error?: string;
}) {
  await db.automationStepRun.create({
    data: {
      runId,
      stepKey,
      status,
      output: output ?? Prisma.JsonNull,
      error,
      finishedAt: new Date(),
    },
  });
}

async function failRun(runId: string, error: string) {
  await db.automationRun.update({
    where: { id: runId },
    data: { status: "FAILED", error },
  });
}

/**
 * Executes an Automation run starting from its currentStepKey, advancing
 * through connected steps synchronously up to MAX_STEPS_PER_INVOCATION.
 */
async function executeRun(runId: string) {
  let run = await db.automationRun.findUnique({
    where: { id: runId },
    include: { automation: true, contact: true },
  });

  if (!run) {
    logger.warn({ runId }, "[AutomationRunQueueService]: Run not found");
    return;
  }

  if (run.status === "COMPLETED" || run.status === "CANCELLED") {
    return;
  }

  const steps = getSteps(run.automation);
  const connections = getConnections(run.automation);

  let stepsExecuted = 0;

  while (stepsExecuted < MAX_STEPS_PER_INVOCATION) {
    if (!run.currentStepKey) {
      await db.automationRun.update({
        where: { id: run.id },
        data: { status: "COMPLETED" },
      });
      return;
    }

    const stepKey: string = run.currentStepKey;
    const step = steps[stepKey];
    if (!step) {
      await failRun(run.id, `Step "${stepKey}" not found`);
      return;
    }

    const context = (run.context ?? {}) as Record<string, unknown>;

    try {
      if (step.type === "trigger") {
        // Trigger step has no work to do; just advance.
        const nextKey = findNextStepKey(connections, run.currentStepKey);
        await recordStepRun({
          runId: run.id,
          stepKey: run.currentStepKey,
          status: "completed",
        });
        run = await db.automationRun.update({
          where: { id: run.id },
          data: { currentStepKey: nextKey ?? null },
          include: { automation: true, contact: true },
        });
      } else if (step.type === "send_email") {
        const config = step.config as {
          subject: string;
          from: string;
          html: string;
        };

        const subject = substituteEventVariables(
          replaceContactVariables(config.subject, run.contact, [
            ...BUILT_IN_CONTACT_VARIABLES,
          ]),
          context,
        );
        const html = substituteEventVariables(
          replaceContactVariables(config.html, run.contact, [
            ...BUILT_IN_CONTACT_VARIABLES,
          ]),
          context,
        );

        const domain = await validateDomainFromEmail(
          config.from,
          run.teamId,
        );

        const email = await db.email.create({
          data: {
            to: [run.contact.email],
            from: config.from,
            subject,
            html,
            teamId: run.teamId,
            contactId: run.contact.id,
            domainId: domain.id,
          },
        });

        await EmailQueueService.queueEmail(
          email.id,
          run.teamId,
          domain.region,
          true,
        );

        const nextKey = findNextStepKey(connections, run.currentStepKey);
        await recordStepRun({
          runId: run.id,
          stepKey: run.currentStepKey,
          status: "completed",
          output: { emailId: email.id },
        });
        run = await db.automationRun.update({
          where: { id: run.id },
          data: { currentStepKey: nextKey ?? null },
          include: { automation: true, contact: true },
        });
      } else if (step.type === "condition") {
        const config = step.config as { rules: SegmentRules };
        const result = evaluateConditionRules(
          config.rules,
          run.contact,
          context,
        );

        const nextKey = findNextStepKey(
          connections,
          run.currentStepKey,
          result ? "true" : "false",
        );

        await recordStepRun({
          runId: run.id,
          stepKey: run.currentStepKey,
          status: "completed",
          output: { result },
        });
        run = await db.automationRun.update({
          where: { id: run.id },
          data: { currentStepKey: nextKey ?? null },
          include: { automation: true, contact: true },
        });
      } else if (step.type === "delay") {
        const config = step.config as { durationMs: number };
        const resumeAt = new Date(Date.now() + (config.durationMs ?? 0));

        await recordStepRun({
          runId: run.id,
          stepKey: run.currentStepKey,
          status: "completed",
        });
        await db.automationRun.update({
          where: { id: run.id },
          data: { status: "WAITING", resumeAt, waitingForEvent: null },
        });
        return;
      } else if (step.type === "wait_for_event") {
        const config = step.config as {
          eventName: string;
          timeoutMs?: number;
        };
        const resumeAt = config.timeoutMs
          ? new Date(Date.now() + config.timeoutMs)
          : null;

        await recordStepRun({
          runId: run.id,
          stepKey: run.currentStepKey,
          status: "completed",
        });
        await db.automationRun.update({
          where: { id: run.id },
          data: {
            status: "WAITING",
            resumeAt,
            waitingForEvent: config.eventName,
          },
        });
        return;
      } else if (step.type === "update_contact") {
        const config = step.config as {
          properties: Record<string, unknown>;
        };

        await updateContactInContactBook(
          run.contact.id,
          run.contact.contactBookId,
          { properties: config.properties as Record<string, string> },
          run.teamId,
        );

        const nextKey = findNextStepKey(connections, run.currentStepKey);
        await recordStepRun({
          runId: run.id,
          stepKey: run.currentStepKey,
          status: "completed",
        });
        run = await db.automationRun.update({
          where: { id: run.id },
          data: { currentStepKey: nextKey ?? null },
          include: { automation: true, contact: true },
        });
      } else if (step.type === "delete_contact") {
        await deleteContactInContactBook(
          run.contact.id,
          run.contact.contactBookId,
          run.teamId,
        );

        const nextKey = findNextStepKey(connections, run.currentStepKey);
        await recordStepRun({
          runId: run.id,
          stepKey: run.currentStepKey,
          status: "completed",
        });
        // Contact is gone; nothing further can reference it meaningfully,
        // but we still advance/complete the run bookkeeping.
        run = await db.automationRun.update({
          where: { id: run.id },
          data: { currentStepKey: nextKey ?? null },
          include: { automation: true, contact: true },
        });
      } else if (step.type === "add_to_segment") {
        // Segments in this schema are rule-based (Segment.rules), not a
        // join table of members, so there's no membership row to create —
        // whether a contact belongs to a segment is computed on read via
        // buildContactWhere(). We just verify the segment exists so a
        // misconfigured step fails loudly instead of silently no-op'ing.
        const config = step.config as { segmentId: string };
        const segment = await db.segment.findFirst({
          where: { id: config.segmentId, teamId: run.teamId },
        });
        if (!segment) {
          throw new Error(`Segment "${config.segmentId}" not found`);
        }
        // Touch buildContactWhere to keep the "reuse" intent explicit even
        // though nothing is persisted here (no-op membership check).
        buildContactWhere(
          segment.rules as unknown as SegmentRules,
          run.teamId,
          segment.contactBookId,
        );

        const nextKey = findNextStepKey(connections, run.currentStepKey);
        await recordStepRun({
          runId: run.id,
          stepKey: run.currentStepKey,
          status: "completed",
        });
        run = await db.automationRun.update({
          where: { id: run.id },
          data: { currentStepKey: nextKey ?? null },
          include: { automation: true, contact: true },
        });
      } else {
        throw new Error(`Unknown step type: ${(step as any).type}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        { err: error, runId: run.id, stepKey: run.currentStepKey },
        "[AutomationRunQueueService]: Step failed",
      );
      await recordStepRun({
        runId: run.id,
        stepKey: run.currentStepKey ?? "unknown",
        status: "failed",
        error: message,
      });
      await failRun(run.id, message);
      return;
    }

    stepsExecuted += 1;
  }

  // Safety cap hit: re-enqueue to continue in a fresh job instead of
  // looping forever synchronously in this worker invocation.
  if (run.status === "RUNNING" && run.currentStepKey) {
    await AutomationRunQueueService.queueRunStep({ runId: run.id });
  }
}

export class AutomationRunQueueService {
  private static queue = new Queue<AutomationRunJob>(AUTOMATION_RUN_QUEUE, {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  });

  static worker = new Worker(
    AUTOMATION_RUN_QUEUE,
    createWorkerHandler(async (job: AutomationRunJob) => {
      await executeRun(job.data.runId);
    }),
    {
      connection: getRedis(),
      concurrency: 10,
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
    },
  );

  static async queueRunStep({ runId }: { runId: string }) {
    await this.queue.add(
      `automation-run-${runId}`,
      { runId },
      { ...DEFAULT_QUEUE_OPTIONS },
    );
  }
}

/**
 * Retoma um AutomationRun que estava WAITING (por delay ou wait_for_event),
 * avançando currentStepKey a partir da conexão de saída do step que causou
 * a espera, mesclando `extraContext` (ex: payload do evento recebido) no
 * contexto do run, e reenfileirando a execução.
 *
 * `condition` seleciona qual aresta seguir a partir do step que esperava:
 * "true"/"false" não se aplicam aqui (isso é só para `condition` steps);
 * usamos undefined para o caminho normal de `delay`, e "timeout" para
 * quando um `wait_for_event` expira sem o evento chegar.
 */
export async function resumeWaitingRun(
  runId: string,
  options?: {
    extraContext?: Record<string, unknown>;
    condition?: "timeout";
  },
) {
  const run = await db.automationRun.findUnique({
    where: { id: runId },
    include: { automation: true },
  });

  if (!run || run.status !== "WAITING") return;

  const connections = getConnections(run.automation);
  const currentKey = run.currentStepKey;

  if (!currentKey) {
    await db.automationRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", waitingForEvent: null, resumeAt: null },
    });
    return;
  }

  const nextKey = findNextStepKey(connections, currentKey, options?.condition);

  const context = (run.context ?? {}) as Record<string, unknown>;
  const mergedContext = options?.extraContext
    ? { ...context, ...options.extraContext }
    : context;

  if (!nextKey) {
    // Sem aresta de saída (ex: wait_for_event sem aresta "timeout"):
    // conclui a execução em vez de deixá-la presa em WAITING para sempre.
    await db.automationRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        waitingForEvent: null,
        resumeAt: null,
        context: mergedContext as Prisma.InputJsonValue,
      },
    });
    return;
  }

  await db.automationRun.update({
    where: { id: run.id },
    data: {
      status: "RUNNING",
      waitingForEvent: null,
      resumeAt: null,
      currentStepKey: nextKey,
      context: mergedContext as Prisma.InputJsonValue,
    },
  });

  await AutomationRunQueueService.queueRunStep({ runId: run.id });
}

export class AutomationEngineService {
  static async startRun(
    automation: Automation,
    contact: Contact,
    context: Record<string, unknown>,
  ): Promise<AutomationRun> {
    const steps = getSteps(automation);
    const triggerKey =
      Object.entries(steps).find(([, step]) => step.type === "trigger")?.[0] ??
      "trigger";

    const run = await db.automationRun.create({
      data: {
        automationId: automation.id,
        teamId: automation.teamId,
        contactId: contact.id,
        currentStepKey: triggerKey,
        status: "RUNNING",
        context: context as Prisma.InputJsonValue,
      },
    });

    await AutomationRunQueueService.queueRunStep({ runId: run.id });

    return run;
  }
}
