import { db } from "../db";
import { logger } from "../logger/log";
import { ContactQueueService } from "./contact-queue-service";
import { registrarProgresso } from "./contact-import-progress";
import {
  analisarArquivo,
  aplicarMapeamento,
  type Mapeamento,
} from "~/lib/contact-import/parse";

/** Quanto tempo o arquivo original fica guardado. Dados pessoais — LGPD. */
export const RETENCAO_DIAS = 90;

export { registrarProgresso };

/**
 * Cria o registro da importação, guarda o arquivo e enfileira os contatos.
 *
 * O parse é refeito **aqui**, a partir do arquivo, e não confiando na lista
 * que o navegador mandou: o que entra na lista é o que está no arquivo que
 * ficou guardado no log. Sem isso, log e resultado poderiam divergir.
 */
export async function iniciarImportacao(opts: {
  teamId: number;
  contactBookId: string;
  userId?: number;
  fileName: string;
  fileKey: string;
  fileSize: number;
  conteudo: string;
  mapeamento: Mapeamento;
}) {
  const arquivo = analisarArquivo(opts.conteudo);
  const { contatos, validos, invalidos, duplicados } = aplicarMapeamento(
    arquivo,
    opts.mapeamento,
  );

  const importaveis = contatos.filter((c) => !c.problema);

  const registro = await db.contactImport.create({
    data: {
      teamId: opts.teamId,
      contactBookId: opts.contactBookId,
      userId: opts.userId,
      fileName: opts.fileName,
      fileKey: opts.fileKey,
      fileSize: opts.fileSize,
      mapping: opts.mapeamento as object,
      status: importaveis.length > 0 ? "processing" : "done",
      total: importaveis.length,
      skipped: invalidos + duplicados,
      finishedAt: importaveis.length > 0 ? null : new Date(),
    },
  });

  if (importaveis.length === 0) {
    return registro;
  }

  await ContactQueueService.addBulkContactJobs(
    opts.contactBookId,
    importaveis.map((c) => ({
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      properties: c.properties,
      subscribed: c.subscribed,
    })),
    opts.teamId,
    registro.id,
  );

  logger.info(
    { importId: registro.id, total: importaveis.length, validos },
    "[ContactImport]: Importação enfileirada",
  );

  return registro;
}

export async function listarImportacoes(contactBookId: string, teamId: number) {
  return db.contactImport.findMany({
    where: { contactBookId, teamId },
    orderBy: { startedAt: "desc" },
    take: 30,
  });
}

export async function buscarImportacao(id: string, teamId: number) {
  return db.contactImport.findFirst({ where: { id, teamId } });
}

/** Arquivo expirado não deve mais ser baixável, mesmo que ainda esteja no bucket. */
export function arquivoExpirado(startedAt: Date): boolean {
  const limite = Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000;
  return startedAt.getTime() < limite;
}
