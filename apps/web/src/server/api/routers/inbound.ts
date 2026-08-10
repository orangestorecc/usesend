import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

const PAGE_SIZE = 30;

export const inboundRouter = createTRPCRouter({
  list: teamProcedure
    .input(z.object({ page: z.number().default(1) }))
    .query(async ({ ctx, input }) => {
      const [emails, total] = await Promise.all([
        db.inboundEmail.findMany({
          where: { teamId: ctx.team.id },
          orderBy: { receivedAt: "desc" },
          take: PAGE_SIZE,
          skip: (input.page - 1) * PAGE_SIZE,
          select: {
            id: true,
            fromEmail: true,
            fromName: true,
            subject: true,
            read: true,
            receivedAt: true,
          },
        }),
        db.inboundEmail.count({ where: { teamId: ctx.team.id } }),
      ]);
      return { emails, totalPage: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
    }),

  get: teamProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const email = await db.inboundEmail.findFirst({
        where: { id: input.id, teamId: ctx.team.id },
      });
      if (email && !email.read) {
        db.inboundEmail
          .update({ where: { id: email.id }, data: { read: true } })
          .catch(() => undefined);
      }
      return email;
    }),
});
