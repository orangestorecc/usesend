import { z } from "zod";

import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

/** Só dígitos, 10 (fixo com DDD) ou 11 (celular com DDD). */
const whatsappSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine(
    (v) => v.length === 10 || v.length === 11,
    "Informe o WhatsApp com DDD, ex.: (81) 99999-9999",
  );

const documentoSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine(
    (v) => v.length === 0 || v.length === 11 || v.length === 14,
    "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)",
  )
  .optional();

export const billingContactRouter = createTRPCRouter({
  get: teamProcedure.query(async ({ ctx }) => {
    return db.billingContact.findUnique({ where: { teamId: ctx.team.id } });
  }),

  upsert: teamProcedure
    .input(
      z.object({
        responsavel: z.string().min(2, "Informe o nome do responsável"),
        email: z.string().email("E-mail inválido"),
        whatsapp: whatsappSchema,
        documento: documentoSchema,
        razaoSocial: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dados = {
        responsavel: input.responsavel.trim(),
        email: input.email.trim().toLowerCase(),
        whatsapp: input.whatsapp,
        documento: input.documento || null,
        razaoSocial: input.razaoSocial?.trim() || null,
      };

      return db.billingContact.upsert({
        where: { teamId: ctx.team.id },
        create: { teamId: ctx.team.id, ...dados },
        update: dados,
      });
    }),
});
