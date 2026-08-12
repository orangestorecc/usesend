import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "../redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  CONTACT_BULK_ADD_QUEUE,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import { createWorkerHandler, TeamJob } from "../queue/bullmq-context";
import { addOrUpdateContact, ContactInput } from "./contact-service";
import { registrarProgresso } from "./contact-import-progress";
import { db } from "../db";

type ContactJobData = {
  contactBookId: string;
  contact: ContactInput;
  teamId?: number;
  /** Quando o contato veio de uma importação por arquivo, para contar progresso. */
  importId?: string;
};

type ContactJob = TeamJob<ContactJobData>;

class ContactQueueService {
  public static queue = new Queue<ContactJobData>(CONTACT_BULK_ADD_QUEUE, {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
    defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
  });

  public static worker = new Worker(
    CONTACT_BULK_ADD_QUEUE,
    createWorkerHandler(processContactJob),
    {
      connection: getRedis(),
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
      concurrency: 20,
    },
  );

  static {
    this.worker.on("error", (err) => {
      logger.error({ err }, "[ContactQueueService]: Worker error");
    });

    logger.info("[ContactQueueService]: Initialized contact queue service");
  }

  public static async addContactJob(
    contactBookId: string,
    contact: ContactInput,
    teamId?: number,
    delay?: number,
  ) {
    await this.queue.add(
      `add-contact-${contact.email}`,
      {
        contactBookId,
        contact,
        teamId,
      },
      {
        delay,
        ...DEFAULT_QUEUE_OPTIONS,
      },
    );
  }

  public static async addBulkContactJobs(
    contactBookId: string,
    contacts: ContactInput[],
    teamId?: number,
    importId?: string,
  ) {
    const jobs = contacts.map((contact) => ({
      name: `add-contact-${contact.email}`,
      data: {
        contactBookId,
        contact,
        teamId,
        importId,
      },
      opts: DEFAULT_QUEUE_OPTIONS,
    }));

    await this.queue.addBulk(jobs);
    logger.info(
      { count: contacts.length, contactBookId },
      "[ContactQueueService]: Added bulk contact jobs to queue",
    );
  }

  public static async getQueueStats() {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
}

async function processContactJob(job: ContactJob) {
  const { contactBookId, contact, teamId, importId } = job.data;

  logger.info(
    { contactEmail: contact.email, contactBookId },
    "[ContactQueueService]: Processing contact job",
  );

  try {
    const existente = await db.contact.findFirst({
      where: { contactBookId, email: contact.email },
      select: { id: true },
    });

    await addOrUpdateContact(contactBookId, contact, teamId);

    if (importId) {
      await registrarProgresso(importId, existente ? "updated" : "created");
    }

    logger.info(
      { contactEmail: contact.email },
      "[ContactQueueService]: Successfully processed contact job",
    );
  } catch (error) {
    if (importId) {
      await registrarProgresso(importId, "skipped");
    }
    logger.error(
      { contactEmail: contact.email, error },
      "[ContactQueueService]: Failed to process contact job",
    );
    throw error;
  }
}

export { ContactQueueService };
