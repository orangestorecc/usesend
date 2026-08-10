import { NextResponse } from "next/server";
import { confirmByProviderCharge } from "~/server/billing/payment-service";
import { logGatewayCall } from "~/server/billing/gateway-log";

export const dynamic = "force-dynamic";

/**
 * Webhook da Rede. O fluxo de cartão é síncrono (autorização na hora), então
 * este endpoint cobre notificações assíncronas (ex: captura tardia / antifraude).
 * Casa o TID com Charge.providerChargeId.
 *
 * Toda requisição recebida é gravada em PaymentGatewayLog (retenção >= 30 dias).
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const expected = process.env.PAYMENTS_WEBHOOK_TOKEN;
  if (expected) {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== expected) {
      void logGatewayCall({
        provider: "rede",
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
      provider: "rede",
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

  const tid = body?.tid ?? body?.transactionId ?? null;
  const approved =
    body?.returnCode === "00" ||
    String(body?.status ?? "").toLowerCase() === "approved" ||
    String(body?.status ?? "").toLowerCase() === "paid";

  let confirmed = false;
  if (tid && approved) confirmed = await confirmByProviderCharge(tid);

  void logGatewayCall({
    provider: "rede",
    direction: "inbound",
    method: "WEBHOOK",
    url: req.url,
    operation: "webhook.transaction",
    requestBody: body,
    responseStatus: 200,
    responseBody: { ok: true, confirmed },
    durationMs: Date.now() - startedAt,
    success: true,
  });

  return NextResponse.json({ ok: true, confirmed });
}
