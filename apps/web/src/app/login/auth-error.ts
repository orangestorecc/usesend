export const INVITATION_REQUIRED_MESSAGE =
  "Você precisa de um convite de time para criar uma conta nesta instância.";
export const GENERIC_AUTH_ERROR_MESSAGE =
  "Não foi possível entrar. Tente novamente.";

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

  if (error === "AccessDenied") {
    return INVITATION_REQUIRED_MESSAGE;
  }

  return GENERIC_AUTH_ERROR_MESSAGE;
}
