import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  arquivoExpirado,
  buscarImportacao,
  listarImportacoes,
  RETENCAO_DIAS,
} from "~/server/service/contact-import-service";
import { getDocumentDownloadUrl } from "~/server/service/storage-service";

export const contactImportRouter = createTRPCRouter({
  list: teamProcedure
    .input(z.object({ contactBookId: z.string() }))
    .query(async ({ ctx, input }) => {
      const registros = await listarImportacoes(
        input.contactBookId,
        ctx.team.id,
      );

      const autores = await db.user.findMany({
        where: {
          id: { in: registros.map((r) => r.userId).filter((id): id is number => id !== null) },
        },
        select: { id: true, name: true, email: true },
      });

      return registros.map((r) => ({
        ...r,
        autor: autores.find((u) => u.id === r.userId) ?? null,
        arquivoDisponivel: !!r.fileKey && !arquivoExpirado(r.startedAt),
      }));
    }),

  get: teamProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const registro = await buscarImportacao(input.id, ctx.team.id);
      if (!registro) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Importação não encontrada.",
        });
      }
      return registro;
    }),

  /** URL temporária para baixar o arquivo original. Gerada só na hora do clique. */
  downloadUrl: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const registro = await buscarImportacao(input.id, ctx.team.id);
      if (!registro || !registro.fileKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "O arquivo desta importação não está guardado.",
        });
      }
      if (arquivoExpirado(registro.startedAt)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Arquivos de importação ficam guardados por ${RETENCAO_DIAS} dias. Este já expirou.`,
        });
      }

      const url = await getDocumentDownloadUrl(
        registro.fileKey,
        registro.fileName,
      );
      return { url };
    }),
});
