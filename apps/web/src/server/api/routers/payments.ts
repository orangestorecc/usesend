import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  teamAdminProcedure,
  teamProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  createCheckout,
  getEnabledInstallments,
  getInstallmentOptions,
  resolveAmount,
  sincronizarCobrancaPendente,
} from "~/server/billing/payment-service";
import { FREE_PLAN_KEY, resolverPlano } from "~/server/billing/plan-service";
import {
  HORAS_ATE_TRAVAR,
  downgradeParaGratis,
} from "~/server/billing/lifecycle-service";

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
        tier: z.number().int().min(0).max(20).default(0),
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

      // Vale a cada cobrança iniciada pelo cliente, e não só na primeira: a
      // trava da tela sozinha nao segura, e sem esses dados nao ha como emitir
      // nota nem avisar sobre a cobranca. A recorrencia automatica nao passa
      // por aqui, entao um plano ja ativo nao quebra se o cadastro sumir.
      const responsavel = await db.billingContact.findUnique({
        where: { teamId: ctx.team.id },
        select: { id: true },
      });
      if (!responsavel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cadastre o responsável financeiro antes de pagar. É para onde vai a nota fiscal.",
        });
      }
      return createCheckout({
        teamId: ctx.team.id,
        product: input.product,
        planKey: input.planKey,
        tier: input.tier,
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
      let charge = await db.charge.findFirst({
        where: { id: input.chargeId, teamId: ctx.team.id },
      });
      if (!charge) throw new Error("Cobrança não encontrada.");

      // Rede de segurança do webhook: se o aviso do banco não chegou, a
      // consulta pega o pagamento aqui. É o que o checkout está fazendo
      // enquanto o cliente olha o QR na tela.
      if (charge.status === "pending") {
        if (await sincronizarCobrancaPendente(charge.id)) {
          charge = await db.charge.findFirstOrThrow({ where: { id: charge.id } });
        }
      }
      return {
        status: charge.status,
        method: charge.method,
        pixQrCode: charge.pixQrCode,
        pixQrImage: charge.pixQrImage,
        boletoUrl: charge.boletoUrl,
        boletoBarcode: charge.boletoBarcode,
      };
    }),

  /** Parcelas habilitadas pelo admin (1x sempre disponível). */
  installmentOptions: teamProcedure.query(async () => {
    return getEnabledInstallments();
  }),

  /**
   * Parcelas com juros já calculados para o plano escolhido — é o que o
   * checkout exibe e o que será cobrado.
   */
  installmentPlan: teamProcedure
    .input(
      z.object({
        product: z.enum(["transactional", "marketing"]),
        planKey: z.string(),
        tier: z.number().int().min(0).max(20).default(0),
        promoCode: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { amountCents } = await resolveAmount(input);
      return getInstallmentOptions(amountCents);
    }),

  /**
   * Estado de cobrança do time, para o aviso no topo do painel e para a tela
   * de faturamento. Uma consulta só: o banner é renderizado em toda página.
   */
  billingState: teamProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const [team, vencida, aberta] = await Promise.all([
      db.team.findUnique({
        where: { id: ctx.team.id },
        select: { planKey: true, planProduct: true, billingBlockedAt: true },
      }),
      db.invoice.findFirst({
        where: { teamId: ctx.team.id, status: "open", dueAt: { lt: now } },
        orderBy: { dueAt: "asc" },
        select: { id: true, number: true, amountCents: true, dueAt: true },
      }),
      db.invoice.findFirst({
        where: { teamId: ctx.team.id, status: "open" },
        orderBy: { dueAt: "asc" },
        select: { id: true, number: true, amountCents: true, dueAt: true },
      }),
    ]);

    const plano = team
      ? await resolverPlano(
          team.planProduct as "transactional" | "marketing",
          team.planKey,
        )
      : null;

    return {
      planKey: team?.planKey ?? FREE_PLAN_KEY,
      planName: plano?.name ?? "Free",
      isPaid: team?.planKey !== FREE_PLAN_KEY,
      blockedAt: team?.billingBlockedAt ?? null,
      /** Fatura que motiva o aviso: a vencida tem prioridade sobre a em aberto. */
      invoice: vencida ?? aberta ?? null,
      isOverdue: Boolean(vencida),
      /** Quantas horas faltam para a trava, quando ainda dá tempo de pagar. */
      hoursUntilBlock:
        vencida?.dueAt && !team?.billingBlockedAt
          ? Math.max(
              0,
              Math.ceil(
                (vencida.dueAt.getTime() +
                  HORAS_ATE_TRAVAR * 3600_000 -
                  now.getTime()) /
                  3600_000,
              ),
            )
          : null,
    };
  }),

  /**
   * Downgrade para o plano gratuito, pedido pelo próprio cliente.
   * Só o admin do time: é uma decisão de contrato, não de operação.
   */
  downgradeParaGratis: teamAdminProcedure.mutation(async ({ ctx }) => {
    const team = await db.team.findUnique({
      where: { id: ctx.team.id },
      select: { planKey: true },
    });
    if (!team || team.planKey === FREE_PLAN_KEY) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Este time já está no plano gratuito.",
      });
    }
    await downgradeParaGratis(ctx.team.id, "downgrade");
    return { ok: true };
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
