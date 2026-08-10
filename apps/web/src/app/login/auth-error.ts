export const INVITATION_REQUIRED_MESSAGE =
  "Você precisa de um convite de time para criar uma conta nesta instância.";
export const GENERIC_AUTH_ERROR_MESSAGE =
  "Não foi possível entrar. Tente novamente.";

export function getAuthErrorMessage(error?: string | null) {
  if (!error) {
    return null;
  }

  if (error === "AccessDenied") {
    return INVITATION_REQUIRED_MESSAGE;
  }

  return GENERIC_AUTH_ERROR_MESSAGE;
}
