import { env } from "~/env";
import { logger } from "../logger/log";
import { cnpjValido, soDigitos } from "~/lib/validadores-br";

/**
 * Consulta de CNPJ na ReceitaWS.
 *
 * Sem token o serviço funciona no plano gratuito, limitado a 3 consultas por
 * minuto por IP — o suficiente para um cadastro ocasional, mas não para uso
 * real. Com o token do plano pago o limite sobe e a resposta é mais rápida.
 * Por isso o token é opcional: a funcionalidade não fica quebrada enquanto
 * ninguém configura.
 */

const BASE = "https://receitaws.com.br/v1/cnpj";
const TEMPO_LIMITE_MS = 12_000;

export type DadosCnpj = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string | null;
  email: string | null;
  telefone: string | null;
  endereco: {
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  };
};

export class ConsultaCnpjError extends Error {
  constructor(
    message: string,
    readonly motivo: "invalido" | "nao-encontrado" | "limite" | "indisponivel",
  ) {
    super(message);
  }
}

function textoOuNulo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** A ReceitaWS devolve telefone como "(81) 3333-4444 / (81) 99999-8888". */
function primeiroTelefone(v: unknown): string | null {
  const t = textoOuNulo(v);
  if (!t) return null;
  const primeiro = t.split("/")[0]?.trim();
  return primeiro?.length ? primeiro : null;
}

export function tokenConfigurado(): boolean {
  return !!env.RECEITAWS_API_TOKEN;
}

export async function consultarCnpj(entrada: string): Promise<DadosCnpj> {
  const cnpj = soDigitos(entrada);

  if (!cnpjValido(cnpj)) {
    throw new ConsultaCnpjError("CNPJ inválido.", "invalido");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEMPO_LIMITE_MS);

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}/${cnpj}`, {
      headers: {
        Accept: "application/json",
        ...(env.RECEITAWS_API_TOKEN
          ? { Authorization: `Bearer ${env.RECEITAWS_API_TOKEN}` }
          : {}),
      },
      signal: controller.signal,
    });
  } catch (err) {
    logger.error({ err, cnpj }, "[ConsultaCnpj]: Falha de rede");
    throw new ConsultaCnpjError(
      "Não consegui falar com a Receita agora. Preencha os dados à mão.",
      "indisponivel",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (resposta.status === 429) {
    throw new ConsultaCnpjError(
      "Muitas consultas seguidas. Espere um minuto ou configure o token da ReceitaWS.",
      "limite",
    );
  }

  if (!resposta.ok) {
    logger.error(
      { status: resposta.status, cnpj },
      "[ConsultaCnpj]: Resposta não-ok",
    );
    throw new ConsultaCnpjError(
      "A consulta de CNPJ está indisponível. Preencha os dados à mão.",
      "indisponivel",
    );
  }

  const json = (await resposta.json()) as Record<string, unknown>;

  // A ReceitaWS responde 200 com {status:"ERROR"} quando não acha o CNPJ.
  if (textoOuNulo(json.status)?.toUpperCase() === "ERROR") {
    throw new ConsultaCnpjError(
      textoOuNulo(json.message) ?? "CNPJ não encontrado.",
      "nao-encontrado",
    );
  }

  return {
    cnpj,
    razaoSocial: textoOuNulo(json.nome) ?? "",
    nomeFantasia: textoOuNulo(json.fantasia),
    situacao: textoOuNulo(json.situacao),
    email: textoOuNulo(json.email),
    telefone: primeiroTelefone(json.telefone),
    endereco: {
      cep: textoOuNulo(json.cep) ? soDigitos(String(json.cep)) : null,
      logradouro: textoOuNulo(json.logradouro),
      numero: textoOuNulo(json.numero),
      complemento: textoOuNulo(json.complemento),
      bairro: textoOuNulo(json.bairro),
      cidade: textoOuNulo(json.municipio),
      uf: textoOuNulo(json.uf),
    },
  };
}
