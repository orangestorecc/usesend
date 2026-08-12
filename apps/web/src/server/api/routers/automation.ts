import { AutomationRunStatus, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { teamProcedure, createTRPCRouter } from "~/server/api/trpc";
import type {
  AutomationConnection,
  AutomationSteps,
} from "~/server/service/automation-service";

const runStatuses = Object.values(AutomationRunStatus) as [
  AutomationRunStatus,
];

const defaultSteps: AutomationSteps = {
  trigger: { type: "trigger", config: {} },
};
const defaultConnections: AutomationConnection[] = [];

function hasTriggerAndConnectedStep(
  steps: AutomationSteps,
  connections: AutomationConnection[],
) {
  const triggerKey = Object.entries(steps).find(
    ([, step]) => step.type === "trigger",
  )?.[0];

  if (!triggerKey) return false;

  return connections.some((c) => c.from === triggerKey);
}

export const automationRouter = createTRPCRouter({
  list: teamProcedure.query(async ({ ctx: { db, team } }) => {
    const automations = await db.automation.findMany({
      where: { teamId: team.id },
      select: {
        id: true,
        name: true,
        status: true,
        triggerEventName: true,
        updatedAt: true,
        _count: { select: { runs: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return automations;
  }),

  get: teamProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx: { db, team }, input }) => {
      const automation = await db.automation.findFirst({
        where: { id: input.id, teamId: team.id },
      });

      if (!automation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automation not found",
        });
      }

      return automation;
    }),

  create: teamProcedure
    .input(
      z.object({
        name: z.string().min(1),
        triggerEventName: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx: { db, team }, input }) => {
      const automation = await db.automation.create({
        data: {
          teamId: team.id,
          name: input.name,
          triggerEventName: input.triggerEventName,
          status: "DRAFT",
          steps: defaultSteps as unknown as Prisma.InputJsonValue,
          connections: defaultConnections as unknown as Prisma.InputJsonValue,
        },
      });

      return automation;
    }),

  update: teamProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        triggerEventName: z.string().min(1).optional(),
        steps: z.record(z.any()).optional(),
        connections: z.array(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx: { db, team }, input }) => {
      const existing = await db.automation.findFirst({
        where: { id: input.id, teamId: team.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automation not found",
        });
      }

      if (existing.status === "ENABLED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot edit an automation while it is enabled",
        });
      }

      const { id, ...data } = input;

      const automation = await db.automation.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.triggerEventName !== undefined
            ? { triggerEventName: data.triggerEventName }
            : {}),
          ...(data.steps !== undefined
            ? { steps: data.steps as Prisma.InputJsonValue }
            : {}),
          ...(data.connections !== undefined
            ? { connections: data.connections as Prisma.InputJsonValue }
            : {}),
        },
      });

      return automation;
    }),

  enable: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx: { db, team }, input }) => {
      const automation = await db.automation.findFirst({
        where: { id: input.id, teamId: team.id },
      });

      if (!automation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automation not found",
        });
      }

      const steps = (automation.steps ?? {}) as unknown as AutomationSteps;
      const connections = (automation
        .connections ?? []) as unknown as AutomationConnection[];

      if (!hasTriggerAndConnectedStep(steps, connections)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "The automation needs a trigger connected to at least one step before it can be enabled",
        });
      }

      return db.automation.update({
        where: { id: input.id },
        data: { status: "ENABLED" },
      });
    }),

  disable: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx: { db, team }, input }) => {
      const automation = await db.automation.findFirst({
        where: { id: input.id, teamId: team.id },
      });

      if (!automation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automation not found",
        });
      }

      return db.automation.update({
        where: { id: input.id },
        data: { status: "DISABLED" },
      });
    }),

  duplicate: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx: { db, team }, input }) => {
      const automation = await db.automation.findFirst({
        where: { id: input.id, teamId: team.id },
      });

      if (!automation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automation not found",
        });
      }

      return db.automation.create({
        data: {
          teamId: team.id,
          name: `${automation.name} (copy)`,
          triggerEventName: automation.triggerEventName,
          status: "DRAFT",
          steps: automation.steps as Prisma.InputJsonValue,
          connections: automation.connections as Prisma.InputJsonValue,
        },
      });
    }),

  delete: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx: { db, team }, input }) => {
      const automation = await db.automation.findFirst({
        where: { id: input.id, teamId: team.id },
      });

      if (!automation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automation not found",
        });
      }

      await db.automation.delete({ where: { id: input.id } });

      return { ok: true };
    }),

  listRuns: teamProcedure
    .input(
      z.object({
        automationId: z.string(),
        status: z.enum(runStatuses).optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).optional(),
      }),
    )
    .query(async ({ ctx: { db, team }, input }) => {
      const automation = await db.automation.findFirst({
        where: { id: input.automationId, teamId: team.id },
        select: { id: true },
      });

      if (!automation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automation not found",
        });
      }

      const limit = input.limit ?? 30;

      const runs = await db.automationRun.findMany({
        where: {
          automationId: input.automationId,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (runs.length > limit) {
        const nextItem = runs.pop();
        nextCursor = nextItem?.id;
      }

      return { runs, nextCursor };
    }),

  getRun: teamProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx: { db, team }, input }) => {
      const run = await db.automationRun.findFirst({
        where: { id: input.id, teamId: team.id },
        include: {
          stepRuns: { orderBy: { startedAt: "asc" } },
          automation: { select: { id: true, name: true } },
          contact: { select: { id: true, email: true } },
        },
      });

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automation run not found",
        });
      }

      return run;
    }),
});
