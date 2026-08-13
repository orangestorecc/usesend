import {
  SESv2Client,
  ListEmailIdentitiesCommand,
  GetEmailIdentityCommand,
  GetAccountCommand,
} from "@aws-sdk/client-sesv2";

import { getAwsCredentialOptions } from "../aws/credentials";
import { logger } from "../logger/log";

/**
 * Identidades do SES da nossa conta.
 *
 * A tela do admin precisa disso porque a tabela `Domain` só tem o que foi
 * criado pelo Madmail. Domínio criado direto no console da AWS não aparece
 * ali — e foi exatamente o que confundiu na apuração de 12/08/2026, quando
 * havia 8 identidades na conta e nenhuma no banco.
 */

export type IdentidadeSes = {
  nome: string;
  tipo: string;
  verificada: boolean;
  /** Estado do DKIM: PENDING, SUCCESS, FAILED, TEMPORARY_FAILURE, NOT_STARTED. */
  dkim: string | null;
  /** Se a AWS ainda espera os registros DNS, quais tokens faltam publicar. */
  tokensDkim: string[];
};

export type ResumoSes = {
  regiao: string;
  producao: boolean;
  envioHabilitado: boolean;
  cotaDiaria: number | null;
  identidades: IdentidadeSes[];
  erro?: string;
};

export async function listarIdentidadesSes(
  regiao = "us-east-1",
): Promise<ResumoSes> {
  const client = new SESv2Client({ region: regiao, ...getAwsCredentialOptions() });

  const base: ResumoSes = {
    regiao,
    producao: false,
    envioHabilitado: false,
    cotaDiaria: null,
    identidades: [],
  };

  try {
    const conta = await client.send(new GetAccountCommand({}));
    base.producao = conta.ProductionAccessEnabled ?? false;
    base.envioHabilitado = conta.SendingEnabled ?? false;
    base.cotaDiaria = conta.SendQuota?.Max24HourSend ?? null;
  } catch (err) {
    logger.error({ err, regiao }, "[SES]: Falha ao ler a conta");
    return { ...base, erro: "Não consegui ler a conta SES. Confira as chaves da AWS." };
  }

  try {
    const lista = await client.send(
      new ListEmailIdentitiesCommand({ PageSize: 100 }),
    );

    // O detalhe do DKIM só vem no GetEmailIdentity, um por identidade. São
    // poucas por conta, então o custo é aceitável para a tela do admin.
    const identidades = await Promise.all(
      (lista.EmailIdentities ?? []).map(async (i) => {
        const nome = i.IdentityName ?? "";
        const item: IdentidadeSes = {
          nome,
          tipo: i.IdentityType ?? "?",
          verificada: false,
          dkim: null,
          tokensDkim: [],
        };
        try {
          const detalhe = await client.send(
            new GetEmailIdentityCommand({ EmailIdentity: nome }),
          );
          item.verificada = detalhe.VerifiedForSendingStatus ?? false;
          item.dkim = detalhe.DkimAttributes?.Status ?? null;
          item.tokensDkim = detalhe.DkimAttributes?.Tokens ?? [];
        } catch {
          // Identidade some entre a listagem e o detalhe: ignora a linha.
        }
        return item;
      }),
    );

    return { ...base, identidades };
  } catch (err) {
    logger.error({ err, regiao }, "[SES]: Falha ao listar identidades");
    return { ...base, erro: "Não consegui listar as identidades do SES." };
  }
}
