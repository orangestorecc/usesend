/** Convite de time vale por 7 dias — mesmo prazo em todos os textos. */
export const INVITE_TTL_DIAS = 7;

const TTL_MS = INVITE_TTL_DIAS * 24 * 60 * 60 * 1000;

/**
 * Mensagem de erro do aceite bloqueado pelo limite do plano. O convidado não
 * pode ver "erro" e perder o convite: a UI reconhece esta mensagem e mostra a
 * tela de "aguardando liberação do administrador".
 */
export const INVITE_BLOQUEADO_POR_LIMITE =
  "O workspace atingiu o limite de membros do plano.";

/**
 * Prazo de um convite criado/reenviado agora. Quem grava `expiresAt` usa isto —
 * é o único lugar que sabe converter o TTL em data.
 */
export function novoPrazoDeConvite(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + TTL_MS);
}

type ConviteComPrazo = {
  expiresAt?: Date | string | null;
  createdAt?: Date | string | null;
};

/**
 * Data em que o convite deixa de valer. Fonte única: servidor e UI leem daqui,
 * ninguém recalcula `createdAt + TTL` por conta própria.
 *
 * O fallback por `createdAt` existe só para dados antigos em cache do cliente
 * (a coluna `expiresAt` é NOT NULL no banco desde a migration
 * `20260817140000_convite_com_prazo_explicito`).
 */
export function dataDeExpiracao(invite: ConviteComPrazo): Date {
  if (invite.expiresAt) return new Date(invite.expiresAt);
  if (invite.createdAt) return new Date(new Date(invite.createdAt).getTime() + TTL_MS);
  // Sem nenhuma das duas datas o convite não é confiável: trate como vencido.
  return new Date(0);
}

export function conviteExpirado(
  invite: ConviteComPrazo,
  agora: Date = new Date(),
): boolean {
  return dataDeExpiracao(invite).getTime() <= agora.getTime();
}
