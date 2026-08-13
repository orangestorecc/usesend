export const ContactEvents = [
  "contact.created",
  "contact.updated",
  "contact.deleted",
] as const;

export type ContactWebhookEventType = (typeof ContactEvents)[number];

export const DomainEvents = [
  "domain.created",
  "domain.verified",
  "domain.updated",
  "domain.deleted",
] as const;

export type DomainWebhookEventType = (typeof DomainEvents)[number];

export const EmailEvents = [
  "email.queued",
  "email.sent",
  "email.delivery_delayed",
  "email.delivered",
  "email.bounced",
  "email.rejected",
  "email.rendering_failure",
  "email.complained",
  "email.failed",
  "email.cancelled",
  "email.suppressed",
  "email.opened",
  "email.clicked",
] as const;

export type EmailWebhookEventType = (typeof EmailEvents)[number];

export const WebhookTestEvents = ["webhook.test"] as const;

export type WebhookTestEventType = (typeof WebhookTestEvents)[number];

// Eventos de recebimento (inbound). Classe separada dos EmailEvents porque a
// semântica de assinatura difere: "todos os eventos" (eventTypes vazio) NÃO
// inclui inbound — o opt-in precisa ser explícito.
export const InboundEmailEvents = ["email.received"] as const;

export type InboundEmailEventType = (typeof InboundEmailEvents)[number];

export const WebhookEvents = [
  ...ContactEvents,
  ...DomainEvents,
  ...EmailEvents,
  ...InboundEmailEvents,
  ...WebhookTestEvents,
] as const;

export type WebhookEventType = (typeof WebhookEvents)[number];

// Eventos de envio: base do "descer de todos os eventos" na UI. Exclui
// inbound (opt-in explícito) e webhook.test (nunca persistido em eventTypes).
export const SendingEvents = [
  ...ContactEvents,
  ...DomainEvents,
  ...EmailEvents,
] as const;

export function isInboundWebhookEvent(
  type: string,
): type is InboundEmailEventType {
  return (InboundEmailEvents as readonly string[]).includes(type);
}

export type EmailStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERY_DELAYED"
  | "DELIVERED"
  | "BOUNCED"
  | "REJECTED"
  | "RENDERING_FAILURE"
  | "COMPLAINED"
  | "FAILED"
  | "CANCELLED"
  | "SUPPRESSED"
  | "OPENED"
  | "CLICKED"
  | "SCHEDULED";

export type EmailBasePayload = {
  id: string;
  status: EmailStatus;
  from: string;
  to: Array<string>;
  occurredAt: string;
  campaignId?: string | null;
  contactId?: string | null;
  domainId?: number | null;
  subject?: string;
  templateId?: string;
  metadata?: Record<string, unknown>;
};

export type ContactPayload = {
  id: string;
  email: string;
  contactBookId: string;
  subscribed: boolean;
  properties: Record<string, unknown>;
  firstName?: string | null;
  lastName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DomainPayload = {
  id: number;
  name: string;
  status: string;
  region: string;
  createdAt: string;
  updatedAt: string;
  clickTracking: boolean;
  openTracking: boolean;
  subdomain?: string | null;
  sesTenantId?: string | null;
  dkimStatus?: string | null;
  spfDetails?: string | null;
  dmarcAdded?: boolean | null;
};

export type EmailBouncedPayload = EmailBasePayload & {
  bounce: {
    type: "Transient" | "Permanent" | "Undetermined";
    subType:
      | "General"
      | "NoEmail"
      | "Suppressed"
      | "OnAccountSuppressionList"
      | "MailboxFull"
      | "MessageTooLarge"
      | "ContentRejected"
      | "AttachmentRejected";
    message?: string;
  };
};

export type EmailFailedPayload = EmailBasePayload & {
  failed: {
    reason: string;
  };
};

export type EmailSuppressedPayload = EmailBasePayload & {
  suppression: {
    type: "Bounce" | "Complaint" | "Manual";
    reason: string;
    source?: string;
  };
};

export type EmailOpenedPayload = EmailBasePayload & {
  open: {
    timestamp: string;
    userAgent?: string;
    ip?: string;
    platform?: string;
  };
};

export type EmailClickedPayload = EmailBasePayload & {
  click: {
    timestamp: string;
    url: string;
    userAgent?: string;
    ip?: string;
    platform?: string;
  };
};

export type WebhookTestPayload = {
  test: boolean;
  webhookId: string;
  sentAt: string;
};

export type EmailReceivedPayload = {
  email_id: string;
  message_id: string | null;
  domain_id: number | null;
  from: { email: string; name: string | null };
  to: string[];
  cc: string[];
  bcc: string[];
  reply_to: string[];
  subject: string | null;
  /** Truncado a 64 KB — corpo completo disponível via API pelo email_id. */
  text: string | null;
  html: string | null;
  truncated: boolean;
  headers: { name: string; value: string }[];
  attachments: { filename: string; content_type: string; size: number }[];
  spam_verdict: string | null;
  received_at: string;
};

export type EmailEventPayloadMap = {
  "email.queued": EmailBasePayload;
  "email.sent": EmailBasePayload;
  "email.delivery_delayed": EmailBasePayload;
  "email.delivered": EmailBasePayload;
  "email.bounced": EmailBouncedPayload;
  "email.rejected": EmailBasePayload;
  "email.rendering_failure": EmailBasePayload;
  "email.complained": EmailBasePayload;
  "email.failed": EmailFailedPayload;
  "email.cancelled": EmailBasePayload;
  "email.suppressed": EmailSuppressedPayload;
  "email.opened": EmailOpenedPayload;
  "email.clicked": EmailClickedPayload;
};

export type DomainEventPayloadMap = {
  "domain.created": DomainPayload;
  "domain.verified": DomainPayload;
  "domain.updated": DomainPayload;
  "domain.deleted": DomainPayload;
};

export type ContactEventPayloadMap = {
  "contact.created": ContactPayload;
  "contact.updated": ContactPayload;
  "contact.deleted": ContactPayload;
};

export type WebhookTestEventPayloadMap = {
  "webhook.test": WebhookTestPayload;
};

export type InboundEmailEventPayloadMap = {
  "email.received": EmailReceivedPayload;
};

export type WebhookEventPayloadMap = EmailEventPayloadMap &
  DomainEventPayloadMap &
  ContactEventPayloadMap &
  InboundEmailEventPayloadMap &
  WebhookTestEventPayloadMap;

export type WebhookPayloadData<TType extends WebhookEventType> =
  WebhookEventPayloadMap[TType];

export type WebhookEvent<TType extends WebhookEventType> = {
  id: string;
  type: TType;
  createdAt: string;
  data: WebhookPayloadData<TType>;
};

export type WebhookEventData = {
  [T in WebhookEventType]: WebhookEvent<T>;
}[WebhookEventType];

export const WEBHOOK_EVENT_VERSION = "2026-01-18";
