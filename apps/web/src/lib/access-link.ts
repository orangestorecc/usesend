/**
 * Validade do link de acesso, em minutos. 30 minutos: tempo de mandar no chat
 * ou no e-mail e a pessoa clicar, não mais.
 *
 * Mora aqui, e não no serviço, porque a UI precisa do número ANTES de o
 * servidor responder (o diálogo de confirmação avisa a duração antes de gerar
 * o link) e o serviço arrasta o banco junto — um componente client não pode
 * importá-lo. Uma constante só: `access-link-service` importa desta linha.
 */
export const ACCESS_LINK_VALIDADE_MINUTOS = 30;

/** Minutos restantes até `expiresAt`, arredondados para cima (mínimo 1). */
export function minutosAte(expiresAt: Date | string): number {
  const restante = new Date(expiresAt).getTime() - Date.now();
  return Math.max(1, Math.round(restante / 60000));
}
