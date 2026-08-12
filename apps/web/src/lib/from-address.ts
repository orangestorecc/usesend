/**
 * Composição e decomposição do remetente (`Nome <caixa@dominio>`).
 *
 * Funções puras de propósito: o formato guardado no banco continua sendo uma
 * string só, e toda a mágica dos três campos acontece na interface. Assim a
 * mudança não exige migration nem toca na API.
 */

export type PartesRemetente = {
  nomeExibicao: string;
  caixa: string;
  dominio: string;
};

const COM_NOME = /^\s*(.*?)\s*<\s*([^@<>\s]+)@([^@<>\s]+)\s*>\s*$/;
const SO_ENDERECO = /^\s*([^@<>\s]+)@([^@<>\s]+)\s*$/;

/** Caracteres aceitos na parte antes do @, na prática do dia a dia. */
const CAIXA_VALIDA = /^[a-zA-Z0-9._%+-]+$/;

export function compor(partes: PartesRemetente): string {
  const caixa = partes.caixa.trim().toLowerCase();
  const dominio = partes.dominio.trim().toLowerCase();
  const endereco = `${caixa}@${dominio}`;
  const nome = partes.nomeExibicao.trim();
  return nome ? `${nome} <${endereco}>` : endereco;
}

/**
 * Tenta quebrar o valor guardado nos três campos.
 *
 * Devolve null quando não reconhece o formato — e aí a tela cai no modo
 * avançado em vez de tentar adivinhar. Reescrever silenciosamente o remetente
 * de uma campanha antiga seria bem pior que mostrar um campo de texto.
 */
export function decompor(valor: string | null | undefined): PartesRemetente | null {
  if (!valor) return null;

  const comNome = COM_NOME.exec(valor);
  if (comNome) {
    return {
      nomeExibicao: comNome[1]!.replace(/^"|"$/g, "").trim(),
      caixa: comNome[2]!.toLowerCase(),
      dominio: comNome[3]!.toLowerCase(),
    };
  }

  const soEndereco = SO_ENDERECO.exec(valor);
  if (soEndereco) {
    return {
      nomeExibicao: "",
      caixa: soEndereco[1]!.toLowerCase(),
      dominio: soEndereco[2]!.toLowerCase(),
    };
  }

  return null;
}

export type ErroCaixa = string | null;

export function validarCaixa(caixa: string): ErroCaixa {
  const v = caixa.trim();
  if (!v) return "Informe a parte antes do @";
  if (v.includes("@")) {
    return "Digite só o que vem antes do @ — o domínio é escolhido ao lado";
  }
  if (!CAIXA_VALIDA.test(v)) {
    return "Use apenas letras, números e . _ + -";
  }
  if (v.startsWith(".") || v.endsWith(".")) {
    return "Não pode começar nem terminar com ponto";
  }
  return null;
}

/**
 * O nome de exibição não pode conter `<`, `>` ou aspas: iriam quebrar o
 * cabeçalho do e-mail ao serem concatenados.
 */
export function validarNomeExibicao(nome: string): ErroCaixa {
  if (/[<>"]/.test(nome)) {
    return "O nome não pode ter < > ou aspas";
  }
  return null;
}

/**
 * O remetente cabe nos campos guiados? Precisa decompor **e** o domínio
 * precisa estar entre os verificados — um domínio que saiu da lista não pode
 * sumir do formulário sem a pessoa perceber.
 */
export function cabeNosCamposGuiados(
  valor: string | null | undefined,
  dominiosVerificados: string[],
): boolean {
  const partes = decompor(valor);
  if (!partes) return false;
  return dominiosVerificados.some(
    (d) => d.toLowerCase() === partes.dominio.toLowerCase(),
  );
}
