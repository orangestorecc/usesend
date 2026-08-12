// Nome de eventos customizados usados para disparar/retomar Automations.
//
// Prefixo "usesend:" é reservado para eventos internos do sistema que ainda
// não existem (ex: usesend:email.opened emitido automaticamente no futuro),
// então times não podem usar esse prefixo em eventos próprios.

export const RESERVED_EVENT_PREFIX = "usesend:";

export type SendEventInput = {
  name: string;
  contactId?: string;
  email?: string;
  payload?: Record<string, unknown>;
};

export type EventValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export function validateEventName(name: unknown): EventValidationResult {
  if (typeof name !== "string" || name.trim().length === 0) {
    return { valid: false, error: "O nome do evento não pode ser vazio" };
  }

  if (name.startsWith(RESERVED_EVENT_PREFIX)) {
    return {
      valid: false,
      error: `O prefixo "${RESERVED_EVENT_PREFIX}" é reservado para eventos do sistema`,
    };
  }

  return { valid: true };
}

export function isReservedEventName(name: string): boolean {
  return name.startsWith(RESERVED_EVENT_PREFIX);
}
