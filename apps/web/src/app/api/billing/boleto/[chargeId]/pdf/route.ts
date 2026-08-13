import { NextResponse } from "next/server";

import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { fetchBoletoPdf } from "~/server/billing/inter";

/**
 * Baixa o PDF do boleto.
 *
 * Existe porque a URL do Inter não é pública — exige Bearer + mTLS, que só o
 * servidor tem. Antes o checkout entregava a URL do banco direto ao cliente e
 * o link respondia erro de autenticação.
 *
 * A cobrança é buscada pelo time da sessão, não só pelo id: como o id da
 * charge circula na URL, filtrar apenas por ele deixaria o boleto de um time
 * acessível a qualquer outro que descobrisse o identificador.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chargeId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const { chargeId } = await params;

  const teamUser = await db.teamUser.findFirst({
    where: { userId: session.user.id },
  });
  if (!teamUser) {
    return new NextResponse("Time não encontrado", { status: 404 });
  }

  const charge = await db.charge.findFirst({
    where: { id: chargeId, teamId: teamUser.teamId, method: "boleto" },
  });
  if (!charge?.providerChargeId) {
    return new NextResponse("Boleto não encontrado", { status: 404 });
  }

  let pdf: Buffer;
  try {
    pdf = await fetchBoletoPdf(charge.providerChargeId);
  } catch (erro) {
    return new NextResponse(
      erro instanceof Error ? erro.message : "Falha ao obter o boleto",
      { status: 502 },
    );
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="boleto-${chargeId.slice(-8)}.pdf"`,
      // Boleto vencido não pode ser servido de cache.
      "Cache-Control": "private, no-store",
    },
  });
}
