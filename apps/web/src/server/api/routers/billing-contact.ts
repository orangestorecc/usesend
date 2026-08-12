import { z } from "zod";

import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  documentoValido,
  emailValido,
  separarTelefone,
  soDigitos,
  telefoneValido,
} from "~/lib/validadores-br";

/** Guardado como E.164 sem o `+`. Valida pelo país embutido no próprio valor. */
const whatsappSchema = z
  .string()
  .transform(soDigitos)
  .refine((v) => {
    const { codigoPais, numero } = separarTelefone(v);
    return telefoneValido(numero, codigoPais);
  }, "Telefone inválido. Confira o DDD e o número.");

const documentoSchema = z
  .string()
  .transform(soDigitos)
  .refine(
    (v) => v.length === 0 || documentoValido(v),
    "CPF ou CNPJ inválido — confira os dígitos.",
  )
  .optional();

const opcional = z.string().trim().optional();

export const billingContactRouter = createTRPCRouter({
  get: teamProcedure.query(async ({ ctx }) => {
    return db.billingContact.findUnique({ where: { teamId: ctx.team.id } });
  }),

  upsert: teamProcedure
    .input(
      z.object({
        responsavel: z.string().trim().min(2, "Informe o nome do responsável"),
        email: z
          .string()
          .trim()
          .refine(emailValido, "E-mail inválido"),
        whatsapp: whatsappSchema,
        documento: documentoSchema,
        razaoSocial: opcional,
        nomeFantasia: opcional,
        cep: z
          .string()
          .transform(soDigitos)
          .refine(
            (v) => v.length === 0 || v.length === 8,
            "CEP deve ter 8 dígitos",
          )
          .optional(),
        logradouro: opcional,
        numero: opcional,
        complemento: opcional,
        bairro: opcional,
        cidade: opcional,
        uf: z
          .string()
          .trim()
          .transform((v) => v.toUpperCase())
          .refine((v) => v.length === 0 || v.length === 2, "UF deve ter 2 letras")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ouNulo = (v?: string) => (v && v.length ? v : null);

      const dados = {
        responsavel: input.responsavel,
        email: input.email.toLowerCase(),
        whatsapp: input.whatsapp,
        documento: ouNulo(input.documento),
        razaoSocial: ouNulo(input.razaoSocial),
        nomeFantasia: ouNulo(input.nomeFantasia),
        cep: ouNulo(input.cep),
        logradouro: ouNulo(input.logradouro),
        numero: ouNulo(input.numero),
        complemento: ouNulo(input.complemento),
        bairro: ouNulo(input.bairro),
        cidade: ouNulo(input.cidade),
        uf: ouNulo(input.uf),
      };

      return db.billingContact.upsert({
        where: { teamId: ctx.team.id },
        create: { teamId: ctx.team.id, ...dados },
        update: dados,
      });
    }),
});
