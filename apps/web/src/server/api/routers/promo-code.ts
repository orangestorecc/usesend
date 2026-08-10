import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  adminProcedure,
  teamProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";

export const promoCodeRouter = createTRPCRouter({
  list: adminProcedure.query(async () => {
    return db.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  }),

  create: adminProcedure
    .input(
      z
        .object({
          code: z
            .string()
            .min(3)
            .max(40)
            .transform((v) => v.trim().toUpperCase()),
          percentOff: z.number().int().min(1).max(100).optional(),
          amountOffCents: z.number().int().min(1).optional(),
          maxRedemptions: z.number().int().min(1).optional(),
          expiresAt: z.string().datetime().optional(),
        })
        .refine((d) => Boolean(d.percentOff) !== Boolean(d.amountOffCents), {
          message: "Informe percentual OU valor fixo (apenas um).",
        }),
    )
    .mutation(async ({ input }) => {
      const existing = await db.promoCode.findUnique({
        where: { code: input.code },
      });
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Já existe um cupom com esse código.",
        });
      }
      return db.promoCode.create({
        data: {
          code: input.code,
          percentOff: input.percentOff ?? null,
          amountOffCents: input.amountOffCents ?? null,
          maxRedemptions: input.maxRedemptions ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
    }),

  toggle: adminProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      return db.promoCode.update({
        where: { id: input.id },
        data: { active: input.active },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.promoCode.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Validação usada no checkout (qualquer time logado).
  validate: teamProcedure
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const promo = await db.promoCode.findUnique({
        where: { code: input.code.trim().toUpperCase() },
      });
      const fail = () => {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cupom inválido ou expirado.",
        });
      };
      if (!promo || !promo.active) fail();
      if (promo!.expiresAt && promo!.expiresAt < new Date()) fail();
      if (
        promo!.maxRedemptions !== null &&
        promo!.redemptions >= promo!.maxRedemptions
      )
        fail();
      return {
        code: promo!.code,
        percentOff: promo!.percentOff,
        amountOffCents: promo!.amountOffCents,
      };
    }),
});
