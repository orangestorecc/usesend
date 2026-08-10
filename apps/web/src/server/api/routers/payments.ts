import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { createCheckout } from "~/server/billing/payment-service";

const cardSchema = z.object({
  number: z.string().min(12),
  holderName: z.string().min(2),
  expirationMonth: z.number().int().min(1).max(12),
  expirationYear: z.number().int().min(2024).max(2100),
  securityCode: z.string().min(3).max(4),
});

export const paymentsRouter = createTRPCRouter({
  checkout: teamProcedure
    .input(
      z.object({
        product: z.enum(["transactional", "marketing"]),
        planKey: z.string(),
        method: z.enum(["card", "pix", "boleto"]),
        promoCode: z.string().optional(),
        installments: z.number().int().min(1).max(12).optional(),
        saveCard: z.boolean().optional(),
        cardToken: z.string().optional(),
        card: cardSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.method === "card" && !input.cardToken && !input.card) {
        throw new Error("Informe os dados do cartão.");
      }
      return createCheckout({
        teamId: ctx.team.id,
        product: input.product,
        planKey: input.planKey,
        method: input.method,
        promoCode: input.promoCode,
        installments: input.installments,
        saveCard: input.saveCard,
        cardToken: input.cardToken,
        card: input.card,
      });
    }),

  getCharge: teamProcedure
    .input(z.object({ chargeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const charge = await db.charge.findFirst({
        where: { id: input.chargeId, teamId: ctx.team.id },
      });
      if (!charge) throw new Error("Cobrança não encontrada.");
      return {
        status: charge.status,
        method: charge.method,
        pixQrCode: charge.pixQrCode,
        pixQrImage: charge.pixQrImage,
        boletoUrl: charge.boletoUrl,
        boletoBarcode: charge.boletoBarcode,
      };
    }),

  paymentMethods: teamProcedure.query(async ({ ctx }) => {
    return db.paymentMethod.findMany({
      where: { teamId: ctx.team.id },
      select: {
        id: true,
        type: true,
        brand: true,
        last4: true,
        expMonth: true,
        expYear: true,
        isDefault: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),
});
