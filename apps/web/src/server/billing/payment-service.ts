import { db } from "~/server/db";
import {
  TRANSACTIONAL_PLANS,
  MARKETING_PLANS,
  type CatalogPlan,
} from "~/lib/constants/plan-catalog";
import * as rede from "./rede";
import * as inter from "./inter";
import { getGatewayConfig, parseInstallments } from "./gateway-config";

/** Parcelas habilitadas hoje pelo admin (1x sempre ativa). */
export async function getEnabledInstallments(): Promise<number[]> {
  const row = await getGatewayConfig("rede");
  return parseInstallments(row?.config.installments);
}

export type Product = "transactional" | "marketing";
export type Method = "card" | "pix" | "boleto";

function resolvePlan(product: Product, planKey: string): CatalogPlan | null {
  const plans = product === "marketing" ? MARKETING_PLANS : TRANSACTIONAL_PLANS;
  return plans.find((p) => p.key === planKey) ?? null;
}

type PromoRow = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
};

async function loadValidPromo(code?: string): Promise<PromoRow | null> {
  if (!code) return null;
  const promo = await db.promoCode.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!promo || !promo.active) return null;
  if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) return null;
  if (promo.maxRedemptions && promo.redemptions >= promo.maxRedemptions)
    return null;
  return {
    id: promo.id,
    code: promo.code,
    percentOff: promo.percentOff,
    amountOffCents: promo.amountOffCents,
  };
}

function applyPromo(priceCents: number, promo: PromoRow | null): number {
  if (!promo) return priceCents;
  let total = priceCents;
  if (promo.percentOff) total = priceCents * (1 - promo.percentOff / 100);
  else if (promo.amountOffCents) total = priceCents - promo.amountOffCents;
  return Math.max(0, Math.round(total));
}

/** Resolve preço final em centavos + valida plano. */
export async function resolveAmount(input: {
  product: Product;
  planKey: string;
  promoCode?: string;
}): Promise<{ plan: CatalogPlan; amountCents: number; promo: PromoRow | null }> {
  const plan = resolvePlan(input.product, input.planKey);
  if (!plan) throw new Error("Plano não encontrado.");
  if (plan.priceBRL === null)
    throw new Error("Plano personalizado — fale com o time de vendas.");
  const promo = await loadValidPromo(input.promoCode);
  const amountCents = applyPromo(plan.priceBRL * 100, promo);
  return { plan, amountCents, promo };
}

/**
 * Ativa o plano pago do time: atualiza Team.plan + cria/atualiza Subscription
 * com o período de 1 mês. Idempotente por período.
 */
async function activatePlan(
  teamId: number,
  product: Product,
  planKey: string,
  method: Method,
) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const priceId = `${product}:${planKey}`;

  await db.team.update({
    where: { id: teamId },
    data: { plan: "BASIC", isActive: true, isBlocked: false },
  });

  const existing = await db.subscription.findFirst({
    where: { teamId, status: { in: ["active", "past_due"] } },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await db.subscription.update({
      where: { id: existing.id },
      data: {
        status: "active",
        priceId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethod: method,
      },
    });
  } else {
    await db.subscription.create({
      data: {
        id: `sub_mad_${teamId}_${Date.now()}`,
        teamId,
        status: "active",
        priceId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethod: method,
      },
    });
  }
}

async function createPaidInvoice(
  teamId: number,
  amountCents: number,
  description: string,
): Promise<string> {
  const count = await db.invoice.count({ where: { teamId } });
  const invoice = await db.invoice.create({
    data: {
      teamId,
      number: `MAD-${(count + 1).toString().padStart(6, "0")}`,
      amountCents,
      currency: "BRL",
      status: "paid",
      description,
      paidAt: new Date(),
    },
  });
  // TODO(NF): emitir nota fiscal (NFS-e) via provedor fiscal (ex: Focus NFe /
  // eNotas) usando BillingProfile + Invoice. Sem provedor fiscal configurado,
  // apenas registramos a fatura interna.
  return invoice.id;
}

/**
 * Fecha uma cobrança aprovada: marca Charge paga, ativa plano, cria fatura,
 * incrementa cupom. Idempotente (não refaz se já estiver paga).
 */
export async function finalizeChargePaid(chargeId: string) {
  const charge = await db.charge.findUnique({ where: { id: chargeId } });
  if (!charge || charge.status === "paid") return;

  const invoiceId = await createPaidInvoice(
    charge.teamId,
    charge.amountCents,
    `${charge.product ?? ""} ${charge.planKey ?? ""}`.trim() || "Assinatura",
  );

  await db.charge.update({
    where: { id: charge.id },
    data: { status: "paid", paidAt: new Date(), invoiceId },
  });

  if (charge.product && charge.planKey) {
    await activatePlan(
      charge.teamId,
      charge.product as Product,
      charge.planKey,
      charge.method as Method,
    );
  }

  if (charge.promoCode) {
    await db.promoCode
      .update({
        where: { code: charge.promoCode },
        data: { redemptions: { increment: 1 } },
      })
      .catch(() => undefined);
  }
}

/** Marca uma cobrança pendente como paga a partir do id do provedor (webhook). */
export async function confirmByProviderCharge(providerChargeId: string) {
  const charge = await db.charge.findFirst({
    where: { providerChargeId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  if (!charge) return false;
  await finalizeChargePaid(charge.id);
  return true;
}

export type CheckoutInput = {
  teamId: number;
  product: Product;
  planKey: string;
  method: Method;
  promoCode?: string;
  installments?: number;
  saveCard?: boolean;
  cardToken?: string; // tokenizado no cliente
  card?: {
    number: string;
    holderName: string;
    expirationMonth: number;
    expirationYear: number;
    securityCode: string;
  };
};

export type CheckoutResult =
  | { status: "paid"; chargeId: string }
  | {
      status: "pending";
      chargeId: string;
      method: Method;
      pix?: { copiaECola: string; qrImage: string | null };
      boleto?: { url: string | null; linhaDigitavel: string | null };
    };

/**
 * Entrada única do checkout. Cria a cobrança no provedor certo e devolve o que
 * a UI precisa mostrar (QR/boleto) ou confirma o pagamento (cartão).
 */
export async function createCheckout(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const { plan, amountCents, promo } = await resolveAmount(input);

  // Plano gratuito: ativa direto, sem gateway.
  if (amountCents <= 0) {
    const charge = await db.charge.create({
      data: {
        teamId: input.teamId,
        method: input.method,
        provider: input.method === "card" ? "rede" : "inter",
        amountCents: 0,
        status: "pending",
        planKey: input.planKey,
        product: input.product,
        promoCode: promo?.code,
      },
    });
    await finalizeChargePaid(charge.id);
    return { status: "paid", chargeId: charge.id };
  }

  const profile = await db.billingProfile.findUnique({
    where: { teamId: input.teamId },
  });

  if (input.method === "card") {
    // Parcelamento: só aceita o que o admin habilitou (padrão: apenas 1x).
    const installments = input.installments ?? 1;
    const enabled = await getEnabledInstallments();
    if (!enabled.includes(installments)) {
      throw new Error(
        `Parcelamento em ${installments}x não está disponível. Opções: ${enabled.join(", ")}x.`,
      );
    }

    const charge = await db.charge.create({
      data: {
        teamId: input.teamId,
        method: "card",
        provider: "rede",
        amountCents,
        status: "pending",
        planKey: input.planKey,
        product: input.product,
        promoCode: promo?.code,
      },
    });

    const result = input.cardToken
      ? await rede.chargeWithToken({
          amountCents,
          reference: charge.id,
          cardToken: input.cardToken,
          installments,
          securityCode: input.card?.securityCode,
          softDescriptor: "MADMAIL",
        })
      : await rede.chargeWithCard({
          amountCents,
          reference: charge.id,
          installments,
          softDescriptor: "MADMAIL",
          generateToken: input.saveCard,
          card: input.card!,
        });

    if (!result.success) {
      await db.charge.update({
        where: { id: charge.id },
        data: {
          status: "failed",
          providerChargeId: result.tid,
          failReason: result.returnMessage ?? result.returnCode ?? "recusado",
        },
      });
      throw new Error(
        `Pagamento recusado: ${result.returnMessage ?? "tente outro cartão"}.`,
      );
    }

    await db.charge.update({
      where: { id: charge.id },
      data: { providerChargeId: result.tid },
    });

    // Salva o token para recorrência (se gerado / reutilizado).
    if (result.cardToken) {
      await db.paymentMethod.updateMany({
        where: { teamId: input.teamId, type: "card" },
        data: { isDefault: false },
      });
      await db.paymentMethod.create({
        data: {
          teamId: input.teamId,
          type: "card",
          provider: "rede",
          cardToken: result.cardToken,
          brand: result.brand,
          last4: result.last4,
          holderName: input.card?.holderName,
          expMonth: input.card?.expirationMonth,
          expYear: input.card?.expirationYear,
          isDefault: true,
        },
      });
    }

    await finalizeChargePaid(charge.id);
    return { status: "paid", chargeId: charge.id };
  }

  if (input.method === "pix") {
    const charge = await db.charge.create({
      data: {
        teamId: input.teamId,
        method: "pix",
        provider: "inter",
        amountCents,
        status: "pending",
        planKey: input.planKey,
        product: input.product,
        promoCode: promo?.code,
      },
    });
    const pix = await inter.createPixCharge({
      amountCents,
      description: `Madmail ${plan.name}`,
      payer: profile
        ? { name: profile.name ?? undefined, document: profile.document ?? undefined }
        : undefined,
    });
    await db.charge.update({
      where: { id: charge.id },
      data: {
        providerChargeId: pix.txid,
        pixQrCode: pix.copiaECola,
        pixQrImage: pix.qrImage,
      },
    });
    return {
      status: "pending",
      chargeId: charge.id,
      method: "pix",
      pix: { copiaECola: pix.copiaECola, qrImage: pix.qrImage },
    };
  }

  // boleto
  if (!profile?.document || !profile?.name) {
    throw new Error(
      "Para boleto, preencha os dados fiscais (nome e CPF/CNPJ) em Configurações > Faturamento.",
    );
  }
  const charge = await db.charge.create({
    data: {
      teamId: input.teamId,
      method: "boleto",
      provider: "inter",
      amountCents,
      status: "pending",
      planKey: input.planKey,
      product: input.product,
      promoCode: promo?.code,
    },
  });
  const due = new Date();
  due.setDate(due.getDate() + 3);
  const boleto = await inter.createBoleto({
    amountCents,
    dueDate: due.toISOString().slice(0, 10),
    seuNumero: charge.id.slice(-15),
    payer: {
      name: profile.name,
      document: profile.document,
      personType: profile.personType === "PF" ? "PF" : "PJ",
      postalCode: profile.postalCode ?? undefined,
      address: profile.addressLine1 ?? undefined,
      city: profile.city ?? undefined,
      state: profile.state ?? undefined,
    },
  });
  await db.charge.update({
    where: { id: charge.id },
    data: {
      providerChargeId: boleto.codigoSolicitacao,
      boletoUrl: boleto.pdfUrl,
      boletoBarcode: boleto.linhaDigitavel,
      pixQrCode: boleto.copiaECola,
    },
  });
  return {
    status: "pending",
    chargeId: charge.id,
    method: "boleto",
    boleto: { url: boleto.pdfUrl, linhaDigitavel: boleto.linhaDigitavel },
  };
}
