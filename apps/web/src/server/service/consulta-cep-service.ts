import { logger } from "../logger/log";
import { cepValido, soDigitos } from "~/lib/validadores-br";

/**
 * Consulta de CEP no ViaCEP.
 *
 * Escolhido em vez da API do gov.br por três motivos práticos: não exige
 * credencial nem cadastro no catálogo Conecta, responde JSON simples e está
 * de pé há mais de uma década sendo usado por meio Brasil. A do gov.br é a
 * fonte mais "oficial", mas passa por gateway com credenciamento — trabalho
 * de integração que não se paga para preencher três campos de endereço.
 */

const BASE = "https://viacep.com.br/ws";
const TEMPO_LIMITE_MS = 8_000;

export type DadosCep = {
  cep: string;
  logradouro: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

export class ConsultaCepError extends Error {
  constructor(
    message: string,
    readonly motivo: "invalido" | "nao-encontrado" | "indisponivel",
  ) {
    super(message);
  }
}

function textoOuNulo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export async function consultarCep(entrada: string): Promise<DadosCep> {
  const cep = soDigitos(entrada);

  if (!cepValido(cep)) {
    throw new ConsultaCepError("CEP deve ter 8 dígitos.", "invalido");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEMPO_LIMITE_MS);

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}/${cep}/json/`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (err) {
    logger.error({ err, cep }, "[ConsultaCep]: Falha de rede");
    throw new ConsultaCepError(
      "Não consegui consultar o CEP agora. Preencha o endereço à mão.",
      "indisponivel",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!resposta.ok) {
    throw new ConsultaCepError(
      "A consulta de CEP está indisponível.",
      "indisponivel",
    );
  }

  const json = (await resposta.json()) as Record<string, unknown>;

  // O ViaCEP responde 200 com {erro:true} para CEP inexistente.
  if (json.erro === true || json.erro === "true") {
    throw new ConsultaCepError("CEP não encontrado.", "nao-encontrado");
  }

  return {
    cep,
    logradouro: textoOuNulo(json.logradouro),
    complemento: textoOuNulo(json.complemento),
    bairro: textoOuNulo(json.bairro),
    cidade: textoOuNulo(json.localidade),
    uf: textoOuNulo(json.uf),
  };
}
