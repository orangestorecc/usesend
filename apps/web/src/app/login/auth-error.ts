import { ACCESS_LINK_VALIDADE_MINUTOS } from "~/lib/access-link";

export const INVITATION_REQUIRED_MESSAGE =
  "Você precisa de um convite de workspace para criar uma conta nesta instância.";
export const GENERIC_AUTH_ERROR_MESSAGE =
  "Não foi possível entrar. Tente novamente.";
/**
 * Único código emitido por `/api/team/access/[token]` (as três recusas usam
 * `access_link_invalido`). Sem esta entrada, o caminho MAIS provável — link de
 * 30 minutos, uso único, clicado horas depois — caía no genérico "Tente
 * novamente", que manda a pessoa clicar de novo no mesmo link morto.
 */
export const ACCESS_LINK_INVALIDO_MESSAGE = `Este link de acesso venceu ou já foi usado. Ele vale ${ACCESS_LINK_VALIDADE_MINUTOS} minutos e só funciona uma vez — peça um novo a quem liberou seu acesso.`;

/**
 * Situações que o NextAuth reporta como "erro" mas que são o fluxo normal:
 * a pessoa precisa entrar. Acontece ao sair da conta e ao expirar a sessão —
 * mostrar "Não foi possível entrar" nesses casos assusta sem motivo.
 */
const NAO_SAO_ERROS = new Set(["SessionRequired", "Configuration"]);

export function getAuthErrorMessage(error?: string | null) {
  if (!error || NAO_SAO_ERROS.has(error)) {
    return null;
  }

  if (error === "access_link_invalido") {
    return ACCESS_LINK_INVALIDO_MESSAGE;
  }

  if (error === "AccessDenied") {
    return INVITATION_REQUIRED_MESSAGE;
  }

  return GENERIC_AUTH_ERROR_MESSAGE;
}
