import { z } from "zod";
import { Prisma, type PlatformIntegration } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { encryptSecret } from "~/server/crypto";
import { testConnection } from "~/server/service/platform/orangestore";
import { PlatformSyncQueueService } from "~/server/service/platform-sync-queue-service";
import {
  createContactBook,
  getContactBooks,
} from "~/server/service/contact-book-service";

const intervalSchema = z
  .number()
  .int()
  .refine((n) => [15, 30, 45, 60].includes(n), "Intervalo inválido");
const subscribeModeSchema = z.enum(["newsletter", "all", "none"]);

// Nunca expõe o segredo criptografado ao cliente.
function toSafe(i: PlatformIntegration) {
  return {
    id: i.id,
    teamId: i.teamId,
    provider: i.provider,
    name: i.name,
    baseUrl: i.baseUrl,
    contactBookId: i.contactBookId,
    intervalMinutes: i.intervalMinutes,
    subscribeMode: i.subscribeMode,
    enabled: i.enabled,
    lastSyncedAt: i.lastSyncedAt,
    lastSyncStatus: i.lastSyncStatus,
    lastSyncError: i.lastSyncError,
    lastSyncCount: i.lastSyncCount,
    createdAt: i.createdAt,
  };
}

export const platformIntegrationRouter = createTRPCRouter({
  list: teamProcedure.query(async ({ ctx }) => {
    const items = await db.platformIntegration.findMany({
      where: { teamId: ctx.team.id },
      orderBy: { createdAt: "desc" },
    });
    return items.map(toSafe);
  }),

  contactBooks: teamProcedure.query(async ({ ctx }) => {
    return getContactBooks(ctx.team.id);
  }),

  test: teamProcedure
    .input(z.object({ baseUrl: z.string().url(), apiKey: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await testConnection(input);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Falha na conexão",
        });
      }
    }),

  create: teamProcedure
    .input(
      z.object({
        name: z.string().min(1),
        baseUrl: z.string().url(),
        apiKey: z.string().min(1),
        provider: z.string().default("orangestore"),
        intervalMinutes: intervalSchema,
        subscribeMode: subscribeModeSchema,
        contactBookId: z.string().optional(),
        newContactBookName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let contactBookId = input.contactBookId;

      if (!contactBookId) {
        if (!input.newContactBookName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione um contact book ou informe o nome de um novo.",
          });
        }
        const book = await createContactBook(
          ctx.team.id,
          input.newContactBookName,
        );
        contactBookId = book.id;
      } else {
        const book = await db.contactBook.findFirst({
          where: { id: contactBookId, teamId: ctx.team.id },
        });
        if (!book) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Contact book não encontrado.",
          });
        }
      }

      const created = await db.platformIntegration.create({
        data: {
          teamId: ctx.team.id,
          provider: input.provider,
          name: input.name,
          baseUrl: input.baseUrl,
          apiKeyEnc: encryptSecret(input.apiKey),
          contactBookId,
          intervalMinutes: input.intervalMinutes,
          subscribeMode: input.subscribeMode,
        },
      });

      // Carga inicial imediata.
      await PlatformSyncQueueService.enqueue(created.id, ctx.team.id);

      return toSafe(created);
    }),

  update: teamProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        baseUrl: z.string().url().optional(),
        apiKey: z.string().min(1).optional(),
        intervalMinutes: intervalSchema.optional(),
        subscribeMode: subscribeModeSchema.optional(),
        enabled: z.boolean().optional(),
        contactBookId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.platformIntegration.findFirst({
        where: { id: input.id, teamId: ctx.team.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integração não encontrada.",
        });
      }

      const data: Prisma.PlatformIntegrationUpdateInput = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
      if (input.apiKey) data.apiKeyEnc = encryptSecret(input.apiKey);
      if (input.intervalMinutes !== undefined)
        data.intervalMinutes = input.intervalMinutes;
      if (input.subscribeMode !== undefined)
        data.subscribeMode = input.subscribeMode;
      if (input.enabled !== undefined) data.enabled = input.enabled;
      if (input.contactBookId !== undefined)
        data.contactBookId = input.contactBookId;

      const updated = await db.platformIntegration.update({
        where: { id: input.id },
        data,
      });
      return toSafe(updated);
    }),

  delete: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.platformIntegration.findFirst({
        where: { id: input.id, teamId: ctx.team.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integração não encontrada.",
        });
      }
      await db.platformIntegration.delete({ where: { id: input.id } });
      return { success: true };
    }),

  syncNow: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.platformIntegration.findFirst({
        where: { id: input.id, teamId: ctx.team.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integração não encontrada.",
        });
      }
      await PlatformSyncQueueService.enqueue(input.id, ctx.team.id);
      return { success: true };
    }),
});
