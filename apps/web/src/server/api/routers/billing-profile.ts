import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import type { BillingContact } from "@prisma/client";

/**
 * O cadastro fiscal do time vive em `BillingContact` -- a mesma tabela que o
 * checkout escreve. Este router mantem o formato antigo do `BillingProfile`
 * na saida para nao quebrar a tela de Configuracoes > Faturamento, mas le e
 * grava na fonte unica. Antes eram duas tabelas que nunca se falavam, e o que
 * o usuario digitava no checkout nunca aparecia nas configuracoes.
 */
function paraPerfil(contato: BillingContact) {
  return {
    id: contato.id,
    teamId: contato.teamId,
    billingEmails: contato.billingEmails.length
      ? contato.billingEmails
      : contato.email
        ? [contato.email]
        : [],
    whatsapp: contato.whatsapp || null,
    personType: contato.personType,
    document: contato.documento,
    name: contato.razaoSocial,
    tradeName: contato.nomeFantasia,
    country: contato.country,
    postalCode: contato.cep,
    addressLine1: contato.logradouro,
    addressLine2: contato.complemento,
    district: contato.bairro,
    city: contato.cidade,
    state: contato.uf,
    responsavel: contato.responsavel,
    numero: contato.numero,
    createdAt: contato.createdAt,
    updatedAt: contato.updatedAt,
  };
}

async function getOrInit(teamId: number, fallbackEmail?: string | null) {
  const existing = await db.billingContact.findUnique({ where: { teamId } });
  if (existing) return existing;
  return db.billingContact.create({
    data: {
      teamId,
      responsavel: "",
      email: fallbackEmail ?? "",
      billingEmails: fallbackEmail ? [fallbackEmail] : [],
      whatsapp: "",
    },
  });
}

export const billingProfileRouter = createTRPCRouter({
  get: teamProcedure.query(async ({ ctx }) => {
    return paraPerfil(await getOrInit(ctx.team.id, ctx.team.billingEmail));
  }),

  // E-mails de faturamento (múltiplos) + WhatsApp.
  updateContact: teamProcedure
    .input(
      z.object({
        billingEmails: z.array(z.string().email()).min(1).max(10),
        // Guardado como E.164 sem o `+`: DDI + número, só dígitos.
        whatsapp: z
          .string()
          .regex(/^\d{10,15}$/, "WhatsApp inválido.")
          .optional()
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getOrInit(ctx.team.id, ctx.team.billingEmail);
      const atualizado = await db.billingContact.update({
        where: { teamId: ctx.team.id },
        data: {
          billingEmails: input.billingEmails,
          // O e-mail principal acompanha o primeiro da lista.
          email: input.billingEmails[0] ?? "",
          whatsapp: input.whatsapp ?? "",
        },
      });
      return paraPerfil(atualizado);
    }),

  // Responsável financeiro / dados fiscais (para NF).
  updateFiscal: teamProcedure
    .input(
      z.object({
        personType: z.enum(["PF", "PJ"]),
        document: z.string().max(20).optional().nullable(),
        name: z.string().max(200).optional().nullable(),
        tradeName: z.string().max(200).optional().nullable(),
        postalCode: z.string().max(12).optional().nullable(),
        addressLine1: z.string().max(200).optional().nullable(),
        addressLine2: z.string().max(200).optional().nullable(),
        district: z.string().max(120).optional().nullable(),
        city: z.string().max(120).optional().nullable(),
        state: z.string().max(2).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getOrInit(ctx.team.id, ctx.team.billingEmail);
      const atualizado = await db.billingContact.update({
        where: { teamId: ctx.team.id },
        data: {
          personType: input.personType,
          documento: input.document ?? null,
          razaoSocial: input.name ?? null,
          nomeFantasia: input.tradeName ?? null,
          country: "BR",
          cep: input.postalCode ?? null,
          logradouro: input.addressLine1 ?? null,
          complemento: input.addressLine2 ?? null,
          bairro: input.district ?? null,
          cidade: input.city ?? null,
          uf: input.state ?? null,
        },
      });
      return paraPerfil(atualizado);
    }),

  invoices: teamProcedure.query(async ({ ctx }) => {
    return db.invoice.findMany({
      where: { teamId: ctx.team.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  // Detalhe de uma fatura: o que foi contratado, como foi pago e os
  // comprovantes (boleto, PIX, cartão, PDF, nota fiscal).
  invoice: teamProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await db.invoice.findFirst({
        where: { id: input.invoiceId, teamId: ctx.team.id },
        include: {
          charges: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              method: true,
              provider: true,
              status: true,
              amountCents: true,
              pixQrCode: true,
              pixQrImage: true,
              boletoUrl: true,
              boletoBarcode: true,
              cardBrand: true,
              cardLast4: true,
              planKey: true,
              product: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      });
      return invoice ?? null;
    }),
});
