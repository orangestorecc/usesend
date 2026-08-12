import { Queue, Worker } from "bullmq";
import { createWorkerHandler, TeamJob } from "../queue/bullmq-context";
import {
  AUTOMATION_SCHEDULER_QUEUE,
  DEFAULT_QUEUE_OPTIONS,
} from "../queue/queue-constants";
import { getRedis, BULL_PREFIX } from "../redis";
import { db } from "../db";
import { logger } from "../logger/log";
import {
  AutomationRunQueueService,
  AutomationConnection,
} from "../service/automation-service";

const SCHEDULER_TICK_MS = 5000;

type SchedulerJob = TeamJob<{}>;

export class AutomationSchedulerService {
  private static schedulerQueue = new Queue<SchedulerJob>(
    AUTOMATION_SCHEDULER_QUEUE,
    {
      connection: getRedis(),
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
    },
  );

  static worker = new Worker(
    AUTOMATION_SCHEDULER_QUEUE,
    createWorkerHandler(async (_job: SchedulerJob) => {
      try {
        const now = new Date();
        const dueRuns = await db.automationRun.findMany({
          where: {
            status: "WAITING",
            resumeAt: { lte: now },
          },
          include: { automation: true },
        });

        for (const run of dueRuns) {
          try {
            if (run.waitingForEvent) {
              // The run was waiting on an event that never arrived within
              // its timeout window. We resume it by following the
              // "timeout" edge out of the wait_for_event step if one was
              // drawn; otherwise there's nothing meaningful to do next, so
              // the run just completes rather than hanging forever.
              const connections = (run.automation
                .connections ?? []) as unknown as AutomationConnection[];
              const currentKey = run.currentStepKey;
              const timeoutKey = currentKey
                ? connections.find(
                    (c) => c.from === currentKey && c.condition === "timeout",
                  )?.to
                : undefined;

              await db.automationRun.update({
                where: { id: run.id },
                data: {
                  status: timeoutKey ? "RUNNING" : "COMPLETED",
                  waitingForEvent: null,
                  resumeAt: null,
                  currentStepKey: timeoutKey ?? null,
                },
              });

              if (timeoutKey) {
                await AutomationRunQueueService.queueRunStep({
                  runId: run.id,
                });
              }
            } else {
              // Plain delay step elapsed; just resume execution from where
              // it left off.
              await db.automationRun.update({
                where: { id: run.id },
                data: { status: "RUNNING", resumeAt: null },
              });
              await AutomationRunQueueService.queueRunStep({ runId: run.id });
            }
          } catch (err) {
            logger.error(
              { err, runId: run.id },
              "Failed to resume automation run",
            );
          }
        }
      } catch (err) {
        logger.error({ err }, "Automation scheduler tick failed");
      }
    }),
    {
      connection: getRedis(),
      concurrency: 1,
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
    },
  );

  static async start() {
    try {
      await this.schedulerQueue.add(
        "tick",
        {},
        {
          jobId: "automation-scheduler",
          repeat: { every: SCHEDULER_TICK_MS },
          ...DEFAULT_QUEUE_OPTIONS,
        },
      );
    } catch (err) {
      // Adding the same repeatable job is idempotent; ignore job-exists errors
      logger.info({ err }, "Automation scheduler start attempted");
    }
  }
}
