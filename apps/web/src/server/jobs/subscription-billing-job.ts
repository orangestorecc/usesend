import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  SUBSCRIPTION_BILLING_QUEUE,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import { db } from "~/server/db";
import * as rede from "~/server/billing/rede";
import { finalizeChargePaid } from "~/server/billing/payment-service";
import { extrasDoTime } from "~/server/billing/overage-service";

const schedulerQueue = new Queue(SUBSCRIPTION_BILLING_QUEUE, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

/**
 * Cobra recorrências de cartão vencidas usando o token salvo (Rede).
 * PIX/boleto não renovam automaticamente — geram nova cobrança por ciclo via UI
 * (ou futura notificação). Aqui tratamos só cartão por token.
 */
async function runBillingTick() {
  const now = new Date();
  const due = await db.subscription.findMany({
    where: {
      status: { in: ["active", "past_due"] },
      paymentMethod: "card",
      currentPeriodEnd: { lte: now },
    },
    take: 100,
  });

  for (const sub of due) {
    const method = await db.paymentMethod.findFirst({
      where: { teamId: sub.teamId, type: "card", isDefault: true },
    });
    if (!method?.cardToken) {
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: "past_due" },
      });
      logger.warn(
        { teamId: sub.teamId, sub: sub.id },
        "[SubscriptionBilling] Sem cartão salvo — marcado past_due",
      );
      continue;
    }

    const [product, planKey] = (sub.priceId ?? ":").split(":");
    // Recupera o valor do plano (centavos).
    const { resolveAmount } = await import("~/server/billing/payment-service");
    let amountCents = 0;
    // Nome do plano na renovação: sem ele a fatura recorrente nasceria sem
    // memória de cálculo e a modal de detalhe não teria o que explicar.
    let planName: string | null = null;
    try {
      const r = await resolveAmount({
        product: (product as "transactional" | "marketing") || "transactional",
        planKey: planKey || "",
        // O passo contratado tem que ir junto: e ele que define o preco.
        tier: sub.tier,
      });
      amountCents = r.amountCents;
      planName = r.plan.name;
    } catch {
      logger.error(
        { sub: sub.id, priceId: sub.priceId },
        "[SubscriptionBilling] Plano inválido — pulando",
      );
      continue;
    }
    if (amountCents <= 0) {
      // plano grátis — só empurra o período
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await db.subscription.update({
        where: { id: sub.id },
        data: { currentPeriodStart: now, currentPeriodEnd: periodEnd },
      });
      continue;
    }

    // Extras do ciclo que encerra: pay-as-you-go e add-ons entram na fatura da
    // renovacao. Calculados agora, a partir do uso, e congelados na cobranca --
    // depois que o mes vira, esse uso nao esta mais disponivel para explicar a
    // conta.
    const extras = await extrasDoTime(sub.teamId);
    const totalCents = amountCents + extras.totalCents;

    const charge = await db.charge.create({
      data: {
        teamId: sub.teamId,
        subscriptionId: sub.id,
        method: "card",
        provider: "rede",
        amountCents: totalCents,
        status: "pending",
        planKey,
        product,
        planName,
        tier: sub.tier,
        // Renovação é sempre preço cheio, sem cupom e sem parcelamento.
        subtotalCents: amountCents,
        overageCents: extras.totalCents,
        overageDetail: extras.detalhe,
        installments: 1,
      },
    });

    try {
      const result = await rede.chargeWithToken({
        amountCents: totalCents,
        reference: charge.id,
        cardToken: method.cardToken,
        softDescriptor: "MADMAIL",
      });

      if (result.success) {
        await db.charge.update({
          where: { id: charge.id },
          data: { providerChargeId: result.tid },
        });
        await finalizeChargePaid(charge.id); // renova período + fatura
      } else {
        await db.charge.update({
          where: { id: charge.id },
          data: {
            status: "failed",
            failReason: result.returnMessage ?? "recusado",
          },
        });
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: "past_due" },
        });
        logger.warn(
          { teamId: sub.teamId, sub: sub.id, msg: result.returnMessage },
          "[SubscriptionBilling] Cobrança recusada — past_due",
        );
        // TODO(notify): e-mail avisando falha + link para atualizar cartão.
      }
    } catch (err) {
      await db.charge.update({
        where: { id: charge.id },
        data: { status: "failed", failReason: "erro no gateway" },
      });
      logger.error(
        { err, sub: sub.id },
        "[SubscriptionBilling] Erro ao cobrar recorrência",
      );
    }
  }
}

const worker = new Worker(SUBSCRIPTION_BILLING_QUEUE, runBillingTick, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "[SubscriptionBilling] Job falhou");
});

export async function initSubscriptionBillingJob() {
  await schedulerQueue.upsertJobScheduler(
    "subscription-billing-tick",
    { pattern: "0 9 * * *", tz: "America/Sao_Paulo" },
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );
  logger.info("[SubscriptionBilling] Iniciado (diário 09:00 BRT)");
}
