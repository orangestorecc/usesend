import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

async function getOrInit(teamId: number, fallbackEmail?: string | null) {
  const existing = await db.billingProfile.findUnique({ where: { teamId } });
  if (existing) return existing;
  return db.billingProfile.create({
    data: {
      teamId,
      billingEmails: fallbackEmail ? [fallbackEmail] : [],
    },
  });
}

export const billingProfileRouter = createTRPCRouter({
  get: teamProcedure.query(async ({ ctx }) => {
    return getOrInit(ctx.team.id, ctx.team.billingEmail);
  }),

  // E-mails de faturamento (múltiplos) + WhatsApp.
  updateContact: teamProcedure
    .input(
      z.object({
        billingEmails: z.array(z.string().email()).max(10),
        whatsapp: z.string().max(30).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getOrInit(ctx.team.id, ctx.team.billingEmail);
      return db.billingProfile.update({
        where: { teamId: ctx.team.id },
        data: {
          billingEmails: input.billingEmails,
          whatsapp: input.whatsapp ?? null,
        },
      });
    }),

  // Responsável financeiro / dados fiscais (para NF).
  updateFiscal: teamProcedure
    .input(
      z.object({
        personType: z.enum(["PF", "PJ"]),
        document: z.string().max(20).optional().nullable(),
        name: z.string().max(200).optional().nullable(),
        tradeName: z.string().max(200).optional().nullable(),
        postalCode: z.string().max(12).optional().nullable(),
        addressLine1: z.string().max(200).optional().nullable(),
        addressLine2: z.string().max(200).optional().nullable(),
        district: z.string().max(120).optional().nullable(),
        city: z.string().max(120).optional().nullable(),
        state: z.string().max(2).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getOrInit(ctx.team.id, ctx.team.billingEmail);
      return db.billingProfile.update({
        where: { teamId: ctx.team.id },
        data: {
          personType: input.personType,
          document: input.document ?? null,
          name: input.name ?? null,
          tradeName: input.tradeName ?? null,
          country: "BR",
          postalCode: input.postalCode ?? null,
          addressLine1: input.addressLine1 ?? null,
          addressLine2: input.addressLine2 ?? null,
          district: input.district ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
        },
      });
    }),

  invoices: teamProcedure.query(async ({ ctx }) => {
    return db.invoice.findMany({
      where: { teamId: ctx.team.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),
});
