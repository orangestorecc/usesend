/** Convite de time vale por 7 dias — mesmo prazo em todos os textos. */
export const INVITE_TTL_DIAS = 7;

/**
 * Mensagem de erro do aceite bloqueado pelo limite do plano. O convidado não
 * pode ver "erro" e perder o convite: a UI reconhece esta mensagem e mostra a
 * tela de "aguardando liberação do administrador".
 */
export const INVITE_BLOQUEADO_POR_LIMITE =
  "O time atingiu o limite de membros do plano.";

/** Instante a partir do qual um convite ainda é válido. */
export function prazoDoConvite(agora: Date = new Date()): Date {
  return new Date(agora.getTime() - INVITE_TTL_DIAS * 24 * 60 * 60 * 1000);
}

export function conviteExpirado(
  invite: { createdAt: Date },
  agora: Date = new Date(),
): boolean {
  return invite.createdAt.getTime() < prazoDoConvite(agora).getTime();
}
