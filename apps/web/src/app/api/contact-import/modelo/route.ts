import { NextResponse } from "next/server";

import { getServerAuthSession } from "~/server/auth";
import { COLUNAS_MODELO, LINHAS_MODELO } from "~/lib/contact-import/parse";

/**
 * Modelo de planilha para o cliente preencher.
 *
 * Sai com BOM e separador `;` porque é assim que o Excel em português abre o
 * arquivo já com as colunas separadas e os acentos certos. Com vírgula e sem
 * BOM, o cliente abre e vê tudo numa coluna só com "JoÃ£o" — e desiste.
 */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const linhas = [COLUNAS_MODELO.join(";")];
  for (const linha of LINHAS_MODELO) {
    linhas.push(linha.join(";"));
  }

  const csv = "﻿" + linhas.join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="modelo-importacao-contatos.csv"',
      "Cache-Control": "no-store",
    },
  });
}
