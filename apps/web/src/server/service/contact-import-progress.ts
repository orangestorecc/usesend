import { db } from "../db";
import { logger } from "../logger/log";

/**
 * Contabilização do progresso de uma importação.
 *
 * Mora num módulo separado de propósito: o `contact-import-service` chama a
 * fila de contatos, e a fila precisa contar progresso. Se as duas coisas
 * estivessem no mesmo arquivo teríamos import circular, que em runtime vira
 * função indefinida na hora errada.
 *
 * Nunca lança: falhar em atualizar um contador não pode derrubar a importação
 * do contato em si.
 */
export async function registrarProgresso(
  importId: string,
  resultado: "created" | "updated" | "skipped",
) {
  try {
    const atualizado = await db.contactImport.update({
      where: { id: importId },
      data: {
        processed: { increment: 1 },
        ...(resultado === "created" ? { created: { increment: 1 } } : {}),
        ...(resultado === "updated" ? { updated: { increment: 1 } } : {}),
        ...(resultado === "skipped" ? { skipped: { increment: 1 } } : {}),
      },
      select: { processed: true, total: true, status: true },
    });

    if (
      atualizado.status === "processing" &&
      atualizado.processed >= atualizado.total
    ) {
      await db.contactImport.update({
        where: { id: importId },
        data: { status: "done", finishedAt: new Date() },
      });
    }
  } catch (err) {
    logger.error(
      { err, importId },
      "[ContactImport]: Falha ao contar progresso",
    );
  }
}
