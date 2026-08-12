import { Contact, Prisma } from "@prisma/client";
import { db } from "../db";
import { logger } from "../logger/log";
import { addOrUpdateContact } from "./contact-service";
import {
  AutomationEngineService,
  AutomationRunQueueService,
  AutomationConnection,
} from "./automation-service";

export type ResolveEventContactInput = {
  teamId: number;
  contactId?: string;
  email?: string;
  contactBookId?: string;
};

/**
 * Resolves the Contact a custom event applies to.
 *
 * - By contactId: looked up scoped to the team (via its contact book).
 * - By email: matched against any contact book owned by the team; if none
 *   is found and a contactBookId was supplied, a new contact is created
 *   there (reusing contact-service's addOrUpdateContact, same as the public
 *   contacts API does).
 */
export async function resolveEventContact({
  teamId,
  contactId,
  email,
  contactBookId,
}: ResolveEventContactInput): Promise<Contact> {
  if (contactId) {
    const contact = await db.contact.findFirst({
      where: { id: contactId, contactBook: { teamId } },
    });
    if (!contact) {
      throw new Error(`Contact "${contactId}" not found for team ${teamId}`);
    }
    return contact;
  }

  if (email) {
    const existing = await db.contact.findFirst({
      where: { email, contactBook: { teamId } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;

    if (contactBookId) {
      return addOrUpdateContact(contactBookId, { email }, teamId);
    }

    throw new Error(
      `No contact found for email "${email}" and no contactBookId provided to create one`,
    );
  }

  throw new Error("Either contactId or email must be provided");
}

export class AutomationEventService {
  static async recordAndDispatch(
    teamId: number,
    input: {
      name: string;
      contact: Contact;
      payload?: Record<string, unknown>;
    },
  ) {
    const { name, contact, payload } = input;

    await db.customEvent.create({
      data: {
        teamId,
        name,
        contactId: contact.id,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
      },
    });

    await Promise.all([
      this.triggerNewAutomations(teamId, name, contact, payload),
      this.resumeWaitingRuns(teamId, name, contact, payload),
    ]);
  }

  private static async triggerNewAutomations(
    teamId: number,
    name: string,
    contact: Contact,
    payload?: Record<string, unknown>,
  ) {
    const automations = await db.automation.findMany({
      where: { teamId, status: "ENABLED", triggerEventName: name },
    });

    for (const automation of automations) {
      try {
        await AutomationEngineService.startRun(automation, contact, {
          event: { name, payload: payload ?? {} },
        });
      } catch (error) {
        logger.error(
          { err: error, automationId: automation.id, contactId: contact.id },
          "[AutomationEventService]: Failed to start automation run",
        );
      }
    }
  }

  private static async resumeWaitingRuns(
    teamId: number,
    name: string,
    contact: Contact,
    payload?: Record<string, unknown>,
  ) {
    const runs = await db.automationRun.findMany({
      where: {
        teamId,
        contactId: contact.id,
        status: "WAITING",
        waitingForEvent: name,
      },
      include: { automation: true },
    });

    for (const run of runs) {
      try {
        const connections = (run.automation
          .connections ?? []) as unknown as AutomationConnection[];

        const currentKey = run.currentStepKey;
        const nextKey = currentKey
          ? connections.find((c) => c.from === currentKey && !c.condition)?.to
          : undefined;

        const existingContext = (run.context ?? {}) as Record<string, unknown>;
        const existingEvent = (existingContext.event ?? {}) as Record<
          string,
          unknown
        >;

        await db.automationRun.update({
          where: { id: run.id },
          data: {
            status: "RUNNING",
            waitingForEvent: null,
            resumeAt: null,
            currentStepKey: nextKey ?? null,
            context: {
              ...existingContext,
              event: { ...existingEvent, name, payload: payload ?? {} },
            } as Prisma.InputJsonValue,
          },
        });

        await AutomationRunQueueService.queueRunStep({ runId: run.id });
      } catch (error) {
        logger.error(
          { err: error, runId: run.id },
          "[AutomationEventService]: Failed to resume waiting run",
        );
      }
    }
  }
}
