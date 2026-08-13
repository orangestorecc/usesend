/**
 * Formatação e validação de cartão de crédito.
 *
 * Tudo aqui é função pura: é o que decide se a cobrança sai, então precisa ser
 * testável sem montar tela. O checkout antes exigia que o cliente digitasse a
 * validade já no formato "MM / AA" e recusava com um toast genérico quando não
 * batia — sem máscara e sem dizer qual campo estava errado.
 */

export type Bandeira = {
  nome: string;
  /** Onde inserir espaços na exibição do número. */
  grupos: number[];
  /** Comprimentos válidos do PAN. */
  tamanhos: number[];
  /** Dígitos do código de segurança. */
  cvc: number;
};

const BANDEIRAS: Array<Bandeira & { regex: RegExp }> = [
  {
    nome: "American Express",
    regex: /^3[47]/,
    grupos: [4, 6, 5],
    tamanhos: [15],
    cvc: 4,
  },
  {
    nome: "Diners",
    regex: /^3(?:0[0-5]|[68])/,
    grupos: [4, 6, 4],
    tamanhos: [14],
    cvc: 3,
  },
  { nome: "Visa", regex: /^4/, grupos: [4, 4, 4, 4], tamanhos: [16], cvc: 3 },
  {
    nome: "Mastercard",
    regex: /^(5[1-5]|2[2-7])/,
    grupos: [4, 4, 4, 4],
    tamanhos: [16],
    cvc: 3,
  },
  {
    nome: "Elo",
    regex: /^(4011|4312|4389|4514|4573|5041|5066|5090|6277|6362|6363)/,
    grupos: [4, 4, 4, 4],
    tamanhos: [16],
    cvc: 3,
  },
  {
    nome: "Hipercard",
    regex: /^(606282|3841)/,
    grupos: [4, 4, 4, 4],
    tamanhos: [16],
    cvc: 3,
  },
];

const PADRAO: Bandeira = {
  nome: "Cartão",
  grupos: [4, 4, 4, 4],
  tamanhos: [13, 14, 15, 16, 17, 18, 19],
  cvc: 3,
};

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Bandeira pelo prefixo (BIN). O Elo vem antes do Visa/Master na checagem
 * porque vários BINs dele começam com 4 ou 5 e cairiam na bandeira errada.
 */
export function detectarBandeira(numero: string): Bandeira {
  const digitos = soDigitos(numero);
  if (!digitos) return PADRAO;
  const elo = BANDEIRAS.find((b) => b.nome === "Elo")!;
  if (elo.regex.test(digitos)) return elo;
  const hiper = BANDEIRAS.find((b) => b.nome === "Hipercard")!;
  if (hiper.regex.test(digitos)) return hiper;
  return BANDEIRAS.find((b) => b.regex.test(digitos)) ?? PADRAO;
}

/** Aplica os espaços da bandeira e corta no comprimento máximo. */
export function formatarNumeroCartao(valor: string): string {
  const bandeira = detectarBandeira(valor);
  const max = Math.max(...bandeira.tamanhos);
  const digitos = soDigitos(valor).slice(0, max);

  const partes: string[] = [];
  let i = 0;
  for (const tamanho of bandeira.grupos) {
    if (i >= digitos.length) break;
    partes.push(digitos.slice(i, i + tamanho));
    i += tamanho;
  }
  if (i < digitos.length) partes.push(digitos.slice(i));
  return partes.join(" ");
}

/**
 * Algoritmo de Luhn — o dígito verificador do cartão. Pega erro de digitação
 * antes de mandar para a Rede, o que evita uma recusa que o cliente leria como
 * "meu cartão foi negado".
 */
export function luhnValido(numero: string): boolean {
  const digitos = soDigitos(numero);
  if (digitos.length < 12) return false;

  let soma = 0;
  let dobra = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = Number(digitos[i]);
    if (dobra) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
    dobra = !dobra;
  }
  return soma % 10 === 0;
}

export function validarNumeroCartao(numero: string): string | null {
  const digitos = soDigitos(numero);
  if (!digitos) return "Informe o número do cartão.";
  const bandeira = detectarBandeira(digitos);
  if (!bandeira.tamanhos.includes(digitos.length)) {
    return `Número incompleto para ${bandeira.nome}.`;
  }
  if (!luhnValido(digitos)) return "Número de cartão inválido.";
  return null;
}

/**
 * Máscara da validade.
 *
 * Digitar "0332" produz "03/32" sozinho — era exatamente o que faltava: o
 * checkout exigia a barra e recusava quem digitava só os números.
 *
 * Mês de 2 a 9 vira "02".."09" na hora, porque não existe mês começando com
 * esses dígitos e assim quem digita "3/25" não precisa do zero à esquerda.
 */
export function formatarValidade(valor: string): string {
  const digitos = soDigitos(valor).slice(0, 4);
  if (!digitos) return "";

  if (digitos.length === 1) {
    return Number(digitos) > 1 ? `0${digitos}/` : digitos;
  }
  const mes = digitos.slice(0, 2);
  const ano = digitos.slice(2);
  return ano ? `${mes}/${ano}` : `${mes}/`;
}

export type Validade = { mes: number; ano: number };

/** Extrai mês/ano da validade digitada. Ano de 2 dígitos vira 20xx. */
export function lerValidade(valor: string): Validade | null {
  const digitos = soDigitos(valor);
  if (digitos.length !== 4 && digitos.length !== 6) return null;
  const mes = Number(digitos.slice(0, 2));
  const anoBruto = digitos.slice(2);
  const ano = anoBruto.length === 2 ? 2000 + Number(anoBruto) : Number(anoBruto);
  if (!Number.isInteger(mes) || !Number.isInteger(ano)) return null;
  return { mes, ano };
}

/**
 * `agora` entra por parâmetro para o teste não depender da data do relógio —
 * um teste que usasse "hoje" passaria hoje e falharia no mês que vem.
 */
export function validarValidade(valor: string, agora = new Date()): string | null {
  const digitos = soDigitos(valor);
  if (!digitos) return "Informe a validade.";
  if (digitos.length < 4) return "Validade incompleta.";

  const lida = lerValidade(valor);
  if (!lida) return "Validade inválida.";
  if (lida.mes < 1 || lida.mes > 12) return "Mês inválido.";

  // O cartão vale até o último dia do mês informado.
  const expiraEm = new Date(lida.ano, lida.mes, 1);
  if (expiraEm <= agora) return "Cartão vencido.";

  // Cartão emitido com validade muito longa é erro de digitação no ano.
  if (lida.ano > agora.getFullYear() + 20) return "Validade inválida.";
  return null;
}

export function validarCvc(cvc: string, numero: string): string | null {
  const digitos = soDigitos(cvc);
  const esperado = detectarBandeira(numero).cvc;
  if (!digitos) return "Informe o código de segurança.";
  if (digitos.length !== esperado) {
    return `O código deve ter ${esperado} dígitos.`;
  }
  return null;
}

export function validarTitular(nome: string): string | null {
  const limpo = nome.trim();
  if (!limpo) return "Informe o nome impresso no cartão.";
  if (limpo.length < 3) return "Nome muito curto.";
  // Cartão traz nome e sobrenome; só o primeiro nome costuma ser recusado pelo
  // emissor na análise antifraude.
  if (!/\s/.test(limpo)) return "Informe nome e sobrenome, como no cartão.";
  if (!/^[\p{L}\s.'-]+$/u.test(limpo)) return "Use apenas letras.";
  return null;
}

export type ErrosCartao = {
  numero: string | null;
  validade: string | null;
  cvc: string | null;
  titular: string | null;
};

export function validarCartao(
  campos: { numero: string; validade: string; cvc: string; titular: string },
  agora = new Date(),
): ErrosCartao {
  return {
    numero: validarNumeroCartao(campos.numero),
    validade: validarValidade(campos.validade, agora),
    cvc: validarCvc(campos.cvc, campos.numero),
    titular: validarTitular(campos.titular),
  };
}

export function temErro(erros: ErrosCartao): boolean {
  return Object.values(erros).some(Boolean);
}
