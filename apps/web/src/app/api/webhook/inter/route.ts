import { NextResponse } from "next/server";
import { confirmByProviderCharge } from "~/server/billing/payment-service";
import { logGatewayCall } from "~/server/billing/gateway-log";

export const dynamic = "force-dynamic";

/**
 * Webhook do Banco Inter (PIX e Cobrança/boleto).
 *
 * PIX imediato:   { pix: [ { txid, valor, horario, endToEndId } ] }
 * Cobrança(boleto): { codigoSolicitacao, situacao: "RECEBIDO"|"PAGO"|... }
 *
 * Casa o identificador do provedor (txid / codigoSolicitacao) com
 * Charge.providerChargeId e ativa o plano. Só afeta cobranças NOSSAS pendentes.
 *
 * Segurança opcional: se PAYMENTS_WEBHOOK_TOKEN estiver setado, exige ?token=.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const expected = process.env.PAYMENTS_WEBHOOK_TOKEN;
  if (expected) {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== expected) {
      void logGatewayCall({
        provider: "inter",
        direction: "inbound",
        method: "WEBHOOK",
        url: req.url,
        operation: "webhook.unauthorized",
        responseStatus: 401,
        success: false,
        error: "token inválido",
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    void logGatewayCall({
      provider: "inter",
      direction: "inbound",
      method: "WEBHOOK",
      url: req.url,
      operation: "webhook.invalid",
      responseStatus: 400,
      success: false,
      error: "JSON inválido",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  let confirmed = 0;

  // PIX imediato
  if (Array.isArray(body?.pix)) {
    for (const p of body.pix) {
      if (p?.txid && (await confirmByProviderCharge(p.txid))) confirmed++;
    }
  }

  // Cobrança / boleto
  const situacao = String(body?.situacao ?? "").toUpperCase();
  if (
    body?.codigoSolicitacao &&
    ["RECEBIDO", "PAGO", "MARCADO_RECEBIDO"].includes(situacao)
  ) {
    if (await confirmByProviderCharge(body.codigoSolicitacao)) confirmed++;
  }

  void logGatewayCall({
    provider: "inter",
    direction: "inbound",
    method: "WEBHOOK",
    url: req.url,
    operation: Array.isArray(body?.pix) ? "webhook.pix" : "webhook.cobranca",
    requestBody: body,
    responseStatus: 200,
    responseBody: { ok: true, confirmed },
    durationMs: Date.now() - startedAt,
    success: true,
  });

  return NextResponse.json({ ok: true, confirmed });
}
