/**
 * Validação e máscara de documentos e contatos brasileiros.
 *
 * Tudo puro e sem dependência externa: são regras estáveis há décadas e
 * pequenas o bastante para não valer uma biblioteca. O que muda com o tempo é
 * a lista de países (embaixo), não o cálculo do dígito verificador.
 */

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

// ------------------------------------------------------------------ CPF

/**
 * Valida CPF pelo dígito verificador.
 *
 * Rejeita os "repetidos" (111.111.111-11 e afins): passam na conta do dígito
 * mas não existem, e são o que aparece quando alguém está só testando o form.
 */
export function cpfValido(valor: string): boolean {
  const cpf = soDigitos(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    let peso = ate + 1;
    for (let i = 0; i < ate; i++) {
      soma += Number(cpf[i]) * peso--;
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export function formatarCpf(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ----------------------------------------------------------------- CNPJ

/** Valida CNPJ pelos dois dígitos verificadores. */
export function cnpjValido(valor: string): boolean {
  const cnpj = soDigitos(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  // Pesos correm da esquerda para a direita: 5,4,3,2,9,8,7,6,5,4,3,2 para o
  // primeiro dígito e 6,5,...,2 para o segundo. Ao chegar em 2, volta para 9.
  const digito = (ate: number): number => {
    let soma = 0;
    let peso = ate - 7;
    for (let i = 0; i < ate; i++) {
      soma += Number(cnpj[i]) * peso;
      peso--;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digito(12) === Number(cnpj[12]) && digito(13) === Number(cnpj[13]);
}

export function formatarCnpj(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// ------------------------------------------------------- CPF ou CNPJ

export type TipoDocumento = "cpf" | "cnpj" | null;

export function tipoDoDocumento(valor: string): TipoDocumento {
  const d = soDigitos(valor);
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return null;
}

export function documentoValido(valor: string): boolean {
  const tipo = tipoDoDocumento(valor);
  if (tipo === "cpf") return cpfValido(valor);
  if (tipo === "cnpj") return cnpjValido(valor);
  return false;
}

/** Formata conforme o tamanho, para o campo aceitar os dois sem trocar de modo. */
export function formatarDocumento(valor: string): string {
  const d = soDigitos(valor);
  return d.length > 11 ? formatarCnpj(d) : formatarCpf(d);
}

// ------------------------------------------------------------------ CEP

export function cepValido(valor: string): boolean {
  return soDigitos(valor).length === 8;
}

export function formatarCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// ---------------------------------------------------------------- E-mail

/**
 * Checagem prática de e-mail: parte local, arroba, domínio com ponto e TLD
 * com pelo menos duas letras. Não tenta implementar a RFC 5322 — ela aceita
 * coisas que nenhum provedor real entrega, e o custo de recusar um endereço
 * válido é bem maior que o de aceitar um exótico.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$/;

export function emailValido(valor: string): boolean {
  const v = valor.trim();
  if (v.length === 0 || v.length > 254) return false;
  if (v.includes("..")) return false;
  return EMAIL_RE.test(v);
}

// --------------------------------------------------------------- Telefone

export type Pais = {
  codigo: string; // ISO 3166-1 alpha-2
  nome: string;
  ddi: string;
  bandeira: string;
  /** Quantidade de dígitos aceita, sem o DDI. */
  digitos: number[];
};

/**
 * Lista curta de propósito: o público é brasileiro, e uma lista de 200 países
 * atrapalha mais do que ajuda. Estes cobrem quem realmente aparece — Brasil,
 * vizinhos com operação comum e os destinos de matriz estrangeira.
 */
export const PAISES: Pais[] = [
  { codigo: "BR", nome: "Brasil", ddi: "55", bandeira: "🇧🇷", digitos: [10, 11] },
  { codigo: "PT", nome: "Portugal", ddi: "351", bandeira: "🇵🇹", digitos: [9] },
  { codigo: "US", nome: "Estados Unidos", ddi: "1", bandeira: "🇺🇸", digitos: [10] },
  { codigo: "AR", nome: "Argentina", ddi: "54", bandeira: "🇦🇷", digitos: [10, 11] },
  { codigo: "CL", nome: "Chile", ddi: "56", bandeira: "🇨🇱", digitos: [9] },
  { codigo: "UY", nome: "Uruguai", ddi: "598", bandeira: "🇺🇾", digitos: [8, 9] },
  { codigo: "PY", nome: "Paraguai", ddi: "595", bandeira: "🇵🇾", digitos: [9] },
  { codigo: "CO", nome: "Colômbia", ddi: "57", bandeira: "🇨🇴", digitos: [10] },
  { codigo: "MX", nome: "México", ddi: "52", bandeira: "🇲🇽", digitos: [10] },
  { codigo: "ES", nome: "Espanha", ddi: "34", bandeira: "🇪🇸", digitos: [9] },
];

export const PAIS_PADRAO = PAISES[0]!;

export function paisPorCodigo(codigo: string): Pais {
  return PAISES.find((p) => p.codigo === codigo) ?? PAIS_PADRAO;
}

export function telefoneValido(numero: string, codigoPais: string): boolean {
  const pais = paisPorCodigo(codigoPais);
  const d = soDigitos(numero);
  if (!pais.digitos.includes(d.length)) return false;

  // No Brasil o DDD começa em 11 e o celular sempre começa com 9 depois dele.
  if (pais.codigo === "BR") {
    const ddd = Number(d.slice(0, 2));
    if (ddd < 11 || ddd > 99) return false;
    if (d.length === 11 && d[2] !== "9") return false;
  }
  return true;
}

/** Máscara só para o Brasil; nos demais devolve agrupado a cada 3 dígitos. */
export function formatarTelefone(numero: string, codigoPais: string): string {
  const pais = paisPorCodigo(codigoPais);
  const max = Math.max(...pais.digitos);
  const d = soDigitos(numero).slice(0, max);

  if (pais.codigo !== "BR") {
    return d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  }

  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Guardado como E.164 sem o `+`: DDI + número, só dígitos. */
export function telefoneParaArmazenar(
  numero: string,
  codigoPais: string,
): string {
  return paisPorCodigo(codigoPais).ddi + soDigitos(numero);
}

/** Quebra o valor guardado de volta em país + número local. */
export function separarTelefone(guardado: string): {
  codigoPais: string;
  numero: string;
} {
  const d = soDigitos(guardado);
  // Do DDI mais longo para o mais curto: 55 não pode roubar o 5 de 598.
  const ordenados = [...PAISES].sort((a, b) => b.ddi.length - a.ddi.length);
  for (const pais of ordenados) {
    if (d.startsWith(pais.ddi)) {
      const resto = d.slice(pais.ddi.length);
      if (pais.digitos.includes(resto.length)) {
        return { codigoPais: pais.codigo, numero: resto };
      }
    }
  }
  return { codigoPais: PAIS_PADRAO.codigo, numero: d };
}
