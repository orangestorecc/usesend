import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

async function getOrInit(teamId: number) {
  const existing = await db.unsubscribePageSettings.findUnique({
    where: { teamId },
  });
  if (existing) return existing;
  return db.unsubscribePageSettings.create({ data: { teamId } });
}

export const unsubscribePageRouter = createTRPCRouter({
  get: teamProcedure.query(async ({ ctx }) => {
    return getOrInit(ctx.team.id);
  }),

  update: teamProcedure
    .input(
      z.object({
        logoUrl: z.string().url().optional().nullable().or(z.literal("")),
        bgColor: z.string().max(9),
        textColor: z.string().max(9),
        accentColor: z.string().max(9),
        hideBranding: z.boolean(),
        prefsTitle: z.string().max(200),
        prefsSubtitle: z.string().max(200),
        unsubButtonLabel: z.string().max(80),
        successTitle: z.string().max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getOrInit(ctx.team.id);
      return db.unsubscribePageSettings.update({
        where: { teamId: ctx.team.id },
        data: {
          logoUrl: input.logoUrl ? input.logoUrl : null,
          bgColor: input.bgColor,
          textColor: input.textColor,
          accentColor: input.accentColor,
          hideBranding: input.hideBranding,
          prefsTitle: input.prefsTitle,
          prefsSubtitle: input.prefsSubtitle,
          unsubButtonLabel: input.unsubButtonLabel,
          successTitle: input.successTitle,
        },
      });
    }),
});
