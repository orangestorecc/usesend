import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, teamProcedure, adminProcedure } from "~/server/api/trpc";
import {
  ConsultaCnpjError,
  consultarCnpj,
  tokenConfigurado,
} from "~/server/service/consulta-cnpj-service";
import {
  ConsultaCepError,
  consultarCep,
} from "~/server/service/consulta-cep-service";
import { listarIdentidadesSes } from "~/server/service/ses-identidades-service";

/**
 * Consultas de apoio ao cadastro (CNPJ e CEP).
 *
 * Passam pelo servidor e não pelo navegador de propósito: evita CORS, mantém
 * o token da ReceitaWS longe do cliente e permite trocar de fornecedor sem
 * mexer na interface.
 */
export const consultaRouter = createTRPCRouter({
  cnpj: teamProcedure
    .input(z.object({ cnpj: z.string().min(14) }))
    .mutation(async ({ input }) => {
      try {
        return await consultarCnpj(input.cnpj);
      } catch (e) {
        if (e instanceof ConsultaCnpjError) {
          throw new TRPCError({
            code: e.motivo === "limite" ? "TOO_MANY_REQUESTS" : "BAD_REQUEST",
            message: e.message,
          });
        }
        throw e;
      }
    }),

  cep: teamProcedure
    .input(z.object({ cep: z.string().min(8) }))
    .mutation(async ({ input }) => {
      try {
        return await consultarCep(input.cep);
      } catch (e) {
        if (e instanceof ConsultaCepError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
        }
        throw e;
      }
    }),

  /**
   * Domínios e endereços cadastrados no SES da nossa conta, com o estado de
   * verificação de cada um. Lê direto da AWS: o banco só conhece os domínios
   * criados pelo Madmail, e a conta costuma ter outros, criados no console.
   */
  identidadesSes: adminProcedure
    .input(z.object({ regiao: z.string().default("us-east-1") }))
    .query(async ({ input }) => {
      return listarIdentidadesSes(input.regiao);
    }),

  /** Estado da integração, para a tela do admin. */
  statusReceitaWs: adminProcedure.query(async () => {
    return { tokenConfigurado: tokenConfigurado() };
  }),

  /** Consulta de teste no admin, com um CNPJ conhecido. */
  testarReceitaWs: adminProcedure
    .input(z.object({ cnpj: z.string().min(14) }))
    .mutation(async ({ input }) => {
      const inicio = Date.now();
      try {
        const dados = await consultarCnpj(input.cnpj);
        return {
          ok: true as const,
          duracaoMs: Date.now() - inicio,
          razaoSocial: dados.razaoSocial,
          situacao: dados.situacao,
          cidade: dados.endereco.cidade,
          uf: dados.endereco.uf,
        };
      } catch (e) {
        return {
          ok: false as const,
          duracaoMs: Date.now() - inicio,
          erro: e instanceof Error ? e.message : "Falha desconhecida",
        };
      }
    }),
});
