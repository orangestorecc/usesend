import { NextResponse } from "next/server";

import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { logger } from "~/server/logger/log";
import { iniciarImportacao } from "~/server/service/contact-import-service";
import {
  isStorageConfigured,
  putDocument,
} from "~/server/service/storage-service";
import type { Mapeamento } from "~/lib/contact-import/parse";

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/**
 * Recebe o arquivo, guarda no bucket e dispara a importação.
 *
 * O upload passa pelo servidor em vez de ir direto do navegador para o S3 com
 * URL assinada: assim não dependemos de CORS configurado no bucket e a
 * autorização fica num lugar só.
 */
export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const vinculo = await db.teamUser.findFirst({
    where: { userId: session.user.id },
    select: { teamId: true },
  });
  if (!vinculo) {
    return NextResponse.json({ error: "Time não encontrado" }, { status: 403 });
  }

  const form = await req.formData();
  const arquivo = form.get("file");
  const contactBookId = String(form.get("contactBookId") ?? "");
  const mapeamentoBruto = String(form.get("mapping") ?? "");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo" }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: "O arquivo passa de 10 MB" },
      { status: 400 },
    );
  }

  const lista = await db.contactBook.findFirst({
    where: { id: contactBookId, teamId: vinculo.teamId },
    select: { id: true },
  });
  if (!lista) {
    return NextResponse.json({ error: "Lista não encontrada" }, { status: 404 });
  }

  let mapeamento: Mapeamento;
  try {
    mapeamento = JSON.parse(mapeamentoBruto) as Mapeamento;
  } catch {
    return NextResponse.json({ error: "Mapeamento inválido" }, { status: 400 });
  }

  if (!Object.values(mapeamento).includes("email")) {
    return NextResponse.json(
      { error: "Escolha qual coluna é o e-mail" },
      { status: 400 },
    );
  }

  const conteudo = await arquivo.text();
  const chave = `contact-imports/${vinculo.teamId}/${contactBookId}/${Date.now()}-${arquivo.name.replace(/[^\w.-]/g, "_")}`;

  // Sem armazenamento configurado a importação ainda roda; só não guarda o
  // arquivo para download depois. Melhor do que bloquear o cliente.
  let chaveGravada = "";
  if (isStorageConfigured()) {
    try {
      await putDocument(chave, conteudo, "text/csv; charset=utf-8");
      chaveGravada = chave;
    } catch (err) {
      logger.error({ err }, "[ContactImport]: Falha ao guardar o arquivo");
    }
  }

  try {
    const registro = await iniciarImportacao({
      teamId: vinculo.teamId,
      contactBookId,
      userId: session.user.id,
      fileName: arquivo.name,
      fileKey: chaveGravada,
      fileSize: arquivo.size,
      conteudo,
      mapeamento,
    });

    return NextResponse.json({ importId: registro.id, total: registro.total });
  } catch (err) {
    logger.error({ err }, "[ContactImport]: Falha ao iniciar a importação");
    return NextResponse.json(
      { error: "Não foi possível iniciar a importação" },
      { status: 500 },
    );
  }
}
