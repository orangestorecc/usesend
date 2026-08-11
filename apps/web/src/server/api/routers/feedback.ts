import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { FeedbackStatus } from "@prisma/client";

import {
  createTRPCRouter,
  teamProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { env } from "~/env";
import { db } from "~/server/db";
import { sendMail } from "~/server/mailer";
import { toPlainHtml } from "~/server/utils/email-content";
import { logger } from "~/server/logger/log";

export const feedbackRouter = createTRPCRouter({
  send: teamProcedure
    .input(
      z.object({
        message: z.string().trim().min(1, "Feedback cannot be empty").max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const senderEmail = ctx.session.user.email ?? null;
      const senderName = ctx.session.user.name ?? null;

      // O registro é a fonte da verdade: grava primeiro, avisa depois.
      const feedback = await db.feedback.create({
        data: {
          message: input.message,
          teamId: ctx.team.id,
          userId: ctx.session.user.id,
          userName: senderName,
          userEmail: senderEmail,
          teamName: ctx.team.name,
        },
      });

      // O aviso por e-mail é best-effort: se falhar, o feedback já está salvo.
      if (env.FOUNDER_EMAIL) {
        const text = `Novo feedback recebido\n\nDe: ${senderName ?? "Desconhecido"} (${
          senderEmail ?? "sem e-mail"
        })\nUser ID: ${ctx.session.user.id}\nCliente: ${ctx.team.name} (ID: ${ctx.team.id})\n\nMensagem:\n${input.message}`;

        try {
          await sendMail(
            env.FOUNDER_EMAIL,
            `Feedback de ${ctx.team.name}`,
            text,
            toPlainHtml(text),
            senderEmail ?? undefined,
          );
        } catch (error) {
          logger.error(
            { err: error, feedbackId: feedback.id },
            "Falha ao notificar feedback por e-mail; registro salvo mesmo assim",
          );
        }
      }

      return { success: true, id: feedback.id, createdAt: feedback.createdAt };
    }),

  /* ---------------- Admin (dono da plataforma) ---------------- */

  list: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        status: z.nativeEnum(FeedbackStatus).optional(),
        search: z.string().trim().optional(),
      }),
    )
    .query(async ({ input }) => {
      const perPage = 20;

      const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? {
              OR: [
                { message: { contains: input.search, mode: "insensitive" as const } },
                { userEmail: { contains: input.search, mode: "insensitive" as const } },
                { userName: { contains: input.search, mode: "insensitive" as const } },
                { teamName: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [feedbacks, total, counts] = await Promise.all([
        db.feedback.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * perPage,
          take: perPage,
          include: {
            team: { select: { id: true, name: true, plan: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        db.feedback.count({ where }),
        db.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
      ]);

      return {
        feedbacks,
        total,
        perPage,
        counts: Object.fromEntries(
          counts.map((c) => [c.status, c._count._all]),
        ) as Partial<Record<FeedbackStatus, number>>,
      };
    }),

  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.nativeEnum(FeedbackStatus),
      }),
    )
    .mutation(async ({ input }) => {
      await db.feedback.update({
        where: { id: input.id },
        data: { status: input.status },
      });
      return { success: true };
    }),

  updateNote: adminProcedure
    .input(
      z.object({
        id: z.number(),
        note: z.string().trim().max(2000).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      await db.feedback.update({
        where: { id: input.id },
        data: { note: input.note && input.note.length > 0 ? input.note : null },
      });
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const feedback = await db.feedback.findUnique({ where: { id: input.id } });
      if (!feedback) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feedback não encontrado.",
        });
      }
      await db.feedback.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
