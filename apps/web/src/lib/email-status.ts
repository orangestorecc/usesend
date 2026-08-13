import { EmailStatus } from "@prisma/client";

/**
 * Rotulos em pt-BR para os status de envio. Usado em badges, filtros e
 * qualquer lugar que exiba o status cru vindo do banco.
 */
export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  SCHEDULED: "Agendado",
  QUEUED: "Na fila",
  SENT: "Enviado",
  DELIVERY_DELAYED: "Entrega atrasada",
  BOUNCED: "Devolvido",
  REJECTED: "Rejeitado",
  RENDERING_FAILURE: "Falha na montagem",
  DELIVERED: "Entregue",
  OPENED: "Aberto",
  CLICKED: "Clicado",
  COMPLAINED: "Marcado como spam",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  SUPPRESSED: "Suprimido",
};

export function emailStatusLabel(status: EmailStatus | string): string {
  return (
    EMAIL_STATUS_LABELS[status as EmailStatus] ??
    String(status).toLowerCase().split("_").join(" ")
  );
}
