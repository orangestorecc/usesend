import { NextResponse } from "next/server";
import { confirmByProviderCharge } from "~/server/billing/payment-service";

export const dynamic = "force-dynamic";

/**
 * Webhook da Rede. O fluxo de cartão é síncrono (autorização na hora), então
 * este endpoint cobre notificações assíncronas (ex: captura tardia / antifraude).
 * Casa o TID com Charge.providerChargeId.
 */
export async function POST(req: Request) {
  const expected = process.env.PAYMENTS_WEBHOOK_TOKEN;
  if (expected) {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const tid = body?.tid ?? body?.transactionId ?? null;
  const approved =
    body?.returnCode === "00" ||
    String(body?.status ?? "").toLowerCase() === "approved" ||
    String(body?.status ?? "").toLowerCase() === "paid";

  let confirmed = false;
  if (tid && approved) confirmed = await confirmByProviderCharge(tid);

  return NextResponse.json({ ok: true, confirmed });
}
