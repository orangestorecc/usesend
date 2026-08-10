import { requireGateway, isPaymentsSandbox, type RedeConfig } from "./gateway-config";

/**
 * Adapter da Rede (e-Rede v1). Autenticação: Basic base64(pv:token).
 * Docs: https://www.userede.com.br/desenvolvedores
 *
 * Fluxo de recorrência escolhido:
 *  - 1ª cobrança: cartão é tokenizado (no cliente, via JS da Rede, ou no 1º auth)
 *    e guardamos o token no nosso banco (PaymentMethod.cardToken).
 *  - Recorrências: chargeWithToken() usa só o token (sem PAN no servidor).
 *
 * CONFERIR contra homologação: nomes exatos do campo de token na resposta e no
 * request de cobrança por token variam por versão do e-Rede.
 */

const BASE = () =>
  isPaymentsSandbox()
    ? "https://rl2-internet-homologacao.userede.com.br/erede/v1"
    : "https://api.userede.com.br/erede/v1";

function authHeader(cfg: RedeConfig): string {
  const basic = Buffer.from(`${cfg.pv}:${cfg.token}`).toString("base64");
  return `Basic ${basic}`;
}

type RedeRaw = {
  returnCode?: string;
  returnMessage?: string;
  tid?: string;
  nsu?: string;
  authorizationCode?: string;
  cardBin?: string;
  last4?: string;
  brand?: { name?: string } | string;
  // token de reuso pode vir em lugares diferentes conforme a versão:
  cardToken?: string;
  token?: string;
  tokenGeneration?: { token?: string };
  [k: string]: unknown;
};

async function redeRequest(
  cfg: RedeConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: RedeRaw }> {
  const res = await fetch(BASE() + path, {
    method,
    headers: {
      Authorization: authHeader(cfg),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: RedeRaw = {};
  try {
    json = (await res.json()) as RedeRaw;
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

/** Retorno aprovado do e-Rede. */
function isApproved(json: RedeRaw): boolean {
  // "00" = autorizado; "355" costuma ser capturado. Aceita ambos.
  return json.returnCode === "00" || json.returnCode === "355";
}

function extractToken(json: RedeRaw): string | null {
  return json.cardToken ?? json.token ?? json.tokenGeneration?.token ?? null;
}

function brandName(json: RedeRaw): string | null {
  if (typeof json.brand === "string") return json.brand;
  return json.brand?.name ?? null;
}

export type CardChargeResult = {
  success: boolean;
  tid: string | null;
  authorizationCode: string | null;
  returnCode: string | null;
  returnMessage: string | null;
  cardToken: string | null; // token de reuso (recorrência)
  brand: string | null;
  last4: string | null;
};

export type ChargeWithCardInput = {
  amountCents: number;
  reference: string; // id único nosso
  installments?: number;
  softDescriptor?: string;
  card: {
    number: string;
    holderName: string;
    expirationMonth: number;
    expirationYear: number;
    securityCode: string;
  };
  generateToken?: boolean; // pedir token de reuso
};

/**
 * Cobrança com dados do cartão (path servidor). Usado quando o cliente NÃO
 * tokenizou no navegador. Se generateToken, retorna cardToken para recorrência.
 */
export async function chargeWithCard(
  input: ChargeWithCardInput,
): Promise<CardChargeResult> {
  const cfg = await requireGateway("rede", ["pv", "token"]);
  const body: Record<string, unknown> = {
    capture: true,
    kind: "credit",
    reference: input.reference,
    amount: input.amountCents,
    installments: input.installments ?? 1,
    cardNumber: input.card.number.replace(/\s/g, ""),
    cardHolderName: input.card.holderName,
    expirationMonth: input.card.expirationMonth,
    expirationYear: input.card.expirationYear,
    securityCode: input.card.securityCode,
    softDescriptor: input.softDescriptor?.slice(0, 22),
  };
  if (input.generateToken) {
    // e-Rede: geração de token de reuso.
    body.tokenGeneration = { generateToken: true };
  }

  const { json } = await redeRequest(cfg, "POST", "/transactions", body);
  const success = isApproved(json);
  return {
    success,
    tid: json.tid ?? null,
    authorizationCode: json.authorizationCode ?? null,
    returnCode: json.returnCode ?? null,
    returnMessage: json.returnMessage ?? null,
    cardToken: success ? extractToken(json) : null,
    brand: brandName(json),
    last4: json.last4 ?? input.card.number.replace(/\s/g, "").slice(-4),
  };
}

export type ChargeWithTokenInput = {
  amountCents: number;
  reference: string;
  cardToken: string;
  installments?: number;
  securityCode?: string; // alguns fluxos exigem CVV mesmo com token
  softDescriptor?: string;
};

/**
 * Cobrança por token salvo (recorrência). Não trafega PAN.
 */
export async function chargeWithToken(
  input: ChargeWithTokenInput,
): Promise<CardChargeResult> {
  const cfg = await requireGateway("rede", ["pv", "token"]);
  const body: Record<string, unknown> = {
    capture: true,
    kind: "credit",
    reference: input.reference,
    amount: input.amountCents,
    installments: input.installments ?? 1,
    cardToken: input.cardToken,
    softDescriptor: input.softDescriptor?.slice(0, 22),
  };
  if (input.securityCode) body.securityCode = input.securityCode;

  const { json } = await redeRequest(cfg, "POST", "/transactions", body);
  const success = isApproved(json);
  return {
    success,
    tid: json.tid ?? null,
    authorizationCode: json.authorizationCode ?? null,
    returnCode: json.returnCode ?? null,
    returnMessage: json.returnMessage ?? null,
    cardToken: input.cardToken,
    brand: brandName(json),
    last4: json.last4 ?? null,
  };
}
