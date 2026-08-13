import { db } from "~/server/db";
import {
  TRANSACTIONAL_PLANS,
  MARKETING_PLANS,
  type CatalogPlan,
} from "~/lib/constants/plan-catalog";
import { precoNoPasso } from "@usesend/lib/src/pricing";
import * as rede from "./rede";
import * as inter from "./inter";
import { enviarAvisoDeCobranca } from "./charge-mailer";
import {
  getGatewayConfig,
  parseInstallments,
  parseInstallmentRates,
  calcularParcela,
  type InstallmentOption,
} from "./gateway-config";

/** Parcelas habilitadas hoje pelo admin (1x sempre ativa). */
export async function getEnabledInstallments(): Promise<number[]> {
  const row = await getGatewayConfig("rede");
  return parseInstallments(row?.config.installments);
}

/**
 * Opções de parcelamento já com juros calculados, para o checkout exibir.
 * O valor cobrado é o `totalCents` da opção escolhida — não o preço do plano.
 */
export async function getInstallmentOptions(
  amountCents: number,
): Promise<InstallmentOption[]> {
  const row = await getGatewayConfig("rede");
  const habilitadas = parseInstallments(row?.config.installments);
  const taxas = parseInstallmentRates(row?.config.installmentRates);
  return habilitadas.map((n) => calcularParcela(amountCents, n, taxas[n] ?? 0));
}

export type Product = "transactional" | "marketing";
export type Method = "card" | "pix" | "boleto";

/**
 * Resolve o plano **e o preço do passo do slider**.
 *
 * O preço é sempre recalculado aqui a partir do par (plano, passo) — o valor
 * que a tela mostrou nunca é aceito. É a única forma de garantir que ninguém
 * cobre a si mesmo o que quiser mexendo na query string.
 */
function resolvePlan(
  product: Product,
  planKey: string,
  tier = 0,
): CatalogPlan | null {
  const plans = product === "marketing" ? MARKETING_PLANS : TRANSACTIONAL_PLANS;
  const base = plans.find((p) => p.key === planKey);
  if (!base) return null;

  const faixa = precoNoPasso(base.key, tier);
  if (!faixa) return base;

  return {
    ...base,
    priceBRL: faixa.precoBRL,
    volume: faixa.volume,
    extra: faixa.extra ?? base.extra,
  };
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
  tier?: number;
  promoCode?: string;
}): Promise<{ plan: CatalogPlan; amountCents: number; promo: PromoRow | null }> {
  const plan = resolvePlan(input.product, input.planKey, input.tier ?? 0);
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

/**
 * Fatura em aberto, criada junto com a cobrança.
 *
 * Antes a fatura só nascia quando o pagamento era confirmado. Quem gerava um
 * PIX e ia conferir em Configurações > Faturamento via "Nenhuma fatura ainda"
 * — nada registrava que havia uma cobrança em andamento.
 */
async function createOpenInvoice(
  teamId: number,
  amountCents: number,
  description: string,
  dueAt?: Date,
): Promise<string> {
  const count = await db.invoice.count({ where: { teamId } });
  const invoice = await db.invoice.create({
    data: {
      teamId,
      number: `MAD-${(count + 1).toString().padStart(6, "0")}`,
      amountCents,
      currency: "BRL",
      status: "open",
      description,
      dueAt,
    },
  });
  return invoice.id;
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

  const descricao =
    `${charge.product ?? ""} ${charge.planKey ?? ""}`.trim() || "Assinatura";

  // PIX e boleto já abriram a fatura quando a cobrança foi criada: aqui ela é
  // quitada. Criar outra duplicaria a mesma cobrança no histórico do cliente.
  let invoiceId = charge.invoiceId;
  if (invoiceId) {
    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: "paid", paidAt: new Date() },
    });
  } else {
    invoiceId = await createPaidInvoice(
      charge.teamId,
      charge.amountCents,
      descricao,
    );
  }

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

/**
 * Confere no provedor se uma cobrança pendente já foi paga.
 *
 * Existe porque depender só do webhook é frágil: se o aviso do banco se perder
 * — app reiniciando no meio do deploy, instabilidade, webhook descadastrado —
 * o pagamento fica presto em "pendente" para sempre, com o dinheiro já na
 * conta. Chamada pelo polling do checkout, então o cliente que acabou de pagar
 * vê a confirmação mesmo se o webhook falhar.
 *
 * Nunca lança: é caminho de leitura de tela, e um erro de rede com o Inter não
 * pode derrubar a página de status da cobrança.
 */
export async function sincronizarCobrancaPendente(
  chargeId: string,
): Promise<boolean> {
  const charge = await db.charge.findUnique({ where: { id: chargeId } });
  if (!charge || charge.status !== "pending") return false;
  if (charge.method !== "pix" || !charge.providerChargeId) return false;

  try {
    const { pago } = await inter.consultarCobrancaPix(charge.providerChargeId);
    if (!pago) return false;
    await finalizeChargePaid(charge.id);
    return true;
  } catch {
    return false;
  }
}

export type CheckoutInput = {
  teamId: number;
  product: Product;
  planKey: string;
  /** Passo do slider — define o preço. Recalculado no servidor. */
  tier?: number;
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
      boleto?: {
        url: string | null;
        linhaDigitavel: string | null;
        codigoBarras: string | null;
      };
    };

/** Dados fiscais do pagador, no formato que os gateways pedem. */
type DadosFiscais = {
  name: string | null;
  document: string | null;
  personType: "PF" | "PJ";
  postalCode: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
};

/**
 * Reúne os dados fiscais do time.
 *
 * `BillingContact` é a fonte única: é o que o checkout grava e o que
 * Configurações > Faturamento passou a ler e escrever. Antes eram duas
 * tabelas (a outra era `BillingProfile`) que nunca se falavam, e quem
 * preenchia no checkout esbarrava em "preencha os dados fiscais" com os dados
 * na tela logo acima.
 */
export async function dadosFiscaisDoPagador(
  teamId: number,
): Promise<DadosFiscais> {
  const contact = await db.billingContact.findUnique({ where: { teamId } });

  const document = contact?.documento ?? null;
  // O documento manda quando dá para decidir: 11 dígitos é CPF, 14 é CNPJ.
  // `personType` só decide quando o documento está vazio ou incompleto —
  // senão um cadastro salvo como PJ com CPF sairia com tipo errado no boleto.
  const digitos = document?.replace(/\D/g, "") ?? "";
  const personType: "PF" | "PJ" =
    digitos.length === 11
      ? "PF"
      : digitos.length === 14
        ? "PJ"
        : contact?.personType === "PF"
          ? "PF"
          : "PJ";

  const logradouro = contact?.logradouro
    ? [contact.logradouro, contact.numero].filter(Boolean).join(", ")
    : null;

  return {
    name: contact?.razaoSocial ?? contact?.responsavel ?? null,
    document,
    personType,
    postalCode: contact?.cep ?? null,
    addressLine1: logradouro,
    city: contact?.cidade ?? null,
    state: contact?.uf ?? null,
  };
}

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

  const profile = await dadosFiscaisDoPagador(input.teamId);

  if (input.method === "card") {
    // Parcelamento: só aceita o que o admin habilitou (padrão: apenas 1x).
    const installments = input.installments ?? 1;
    const enabled = await getEnabledInstallments();
    if (!enabled.includes(installments)) {
      throw new Error(
        `Parcelamento em ${installments}x não está disponível. Opções: ${enabled.join(", ")}x.`,
      );
    }

    // Com juros, o valor cobrado é o total parcelado — não o preço do plano.
    // O cálculo é refeito aqui no servidor de propósito: confiar no que o
    // navegador mandou permitiria pagar menos escolhendo outra parcela.
    const opcoes = await getInstallmentOptions(amountCents);
    const opcao = opcoes.find((o) => o.parcelas === installments);
    const totalCobrado = opcao?.totalCents ?? amountCents;

    const charge = await db.charge.create({
      data: {
        teamId: input.teamId,
        method: "card",
        provider: "rede",
        amountCents: totalCobrado,
        status: "pending",
        planKey: input.planKey,
        product: input.product,
        promoCode: promo?.code,
      },
    });

    const result = input.cardToken
      ? await rede.chargeWithToken({
          amountCents: totalCobrado,
          reference: charge.id,
          cardToken: input.cardToken,
          installments,
          securityCode: input.card?.securityCode,
          softDescriptor: "MADMAIL",
        })
      : await rede.chargeWithCard({
          amountCents: totalCobrado,
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

    // Bandeira e final ficam na propria cobranca para a tela de detalhe da
    // fatura: o PaymentMethod so existe quando o cliente pede para salvar o
    // cartao, e pode ser trocado depois.
    await db.charge.update({
      where: { id: charge.id },
      data: {
        providerChargeId: result.tid,
        cardBrand: result.brand ?? null,
        cardLast4: result.last4 ?? null,
      },
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
    const invoiceId = await createOpenInvoice(
      input.teamId,
      amountCents,
      `${plan.name} — assinatura mensal`,
      // PIX expira em 1h, mas a fatura vence no dia: quem paga depois do QR
      // expirar gera outro, e não faz sentido a fatura constar vencida no
      // mesmo minuto.
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
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
        invoiceId,
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
    // Sem await: o cliente não espera o e-mail para ver o QR na tela.
    void enviarAvisoDeCobranca(charge.id);
    return {
      status: "pending",
      chargeId: charge.id,
      method: "pix",
      pix: { copiaECola: pix.copiaECola, qrImage: pix.qrImage },
    };
  }

  // boleto
  if (!profile.document || !profile.name) {
    throw new Error(
      "Para boleto, informe nome e CPF/CNPJ no responsável financeiro, aqui mesmo no checkout.",
    );
  }
  const due = new Date();
  due.setDate(due.getDate() + 3);
  const invoiceId = await createOpenInvoice(
    input.teamId,
    amountCents,
    `${plan.name} — assinatura mensal`,
    due,
  );
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
      invoiceId,
    },
  });
  const boleto = await inter.createBoleto({
    amountCents,
    dueDate: due.toISOString().slice(0, 10),
    seuNumero: charge.id.slice(-15),
    payer: {
      name: profile.name,
      document: profile.document,
      personType: profile.personType,
      postalCode: profile.postalCode ?? undefined,
      address: profile.addressLine1 ?? undefined,
      city: profile.city ?? undefined,
      state: profile.state ?? undefined,
    },
  });
  // O PDF é servido pela nossa rota, não pela URL do Inter: a do banco exige
  // Bearer + mTLS e responderia erro de autenticação no navegador do cliente.
  const pdfUrl = `/api/billing/boleto/${charge.id}/pdf`;
  await db.charge.update({
    where: { id: charge.id },
    data: {
      providerChargeId: boleto.codigoSolicitacao,
      boletoUrl: pdfUrl,
      boletoBarcode: boleto.codigoBarras ?? boleto.linhaDigitavel,
      pixQrCode: boleto.copiaECola,
    },
  });
  void enviarAvisoDeCobranca(charge.id);
  return {
    status: "pending",
    chargeId: charge.id,
    method: "boleto",
    boleto: {
      url: pdfUrl,
      linhaDigitavel: boleto.linhaDigitavel,
      codigoBarras: boleto.codigoBarras,
    },
  };
}
