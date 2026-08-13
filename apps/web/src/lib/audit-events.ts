/**
 * Constantes da auditoria, separadas do serviço de propósito: a tela do
 * administrador é client component e importar o serviço puxaria `db` e o
 * logger (e com eles `fs`) para o bundle do navegador.
 */

/**
 * Eventos críticos de conta. A lista é fechada de propósito: um evento com
 * nome livre não é filtrável na tela de auditoria do administrador.
 */
export const AUDIT_EVENTS = [
  "mfa_enabled",
  "mfa_disabled",
  "mfa_reset_requested",
  "mfa_reset_executed",
  "mfa_reset_canceled",
  "email_change_requested",
  "email_changed",
  "email_change_reverted",
  "account_deleted",
  "invite_accepted",
  "team_left",
  "impersonate_started",
  "session_revoked",
  // Controle de bounce (docs-spec/BOUNCE-CONTROL-SPEC.md §3)
  "reputation_policy_updated",
  "reputation_team_viewed",
  "reputation_team_blocked",
  "reputation_team_unblocked",
  "reputation_team_supervised",
  "reputation_team_exempted",
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

/** Eventos destrutivos ganham badge vermelha na tela do administrador. */
export const AUDIT_EVENTOS_DESTRUTIVOS: AuditEvent[] = [
  "account_deleted",
  "mfa_disabled",
  "mfa_reset_executed",
  "team_left",
  "reputation_team_blocked",
];

/** Auditoria fica 12 meses; depois disso o purge apaga. */
export const AUDIT_RETENCAO_MESES = 12;

export const AUDIT_ROTULOS: Record<AuditEvent, string> = {
  mfa_enabled: "MFA ativado",
  mfa_disabled: "MFA desativado",
  mfa_reset_requested: "Reset de MFA solicitado",
  mfa_reset_executed: "Reset de MFA executado",
  mfa_reset_canceled: "Reset de MFA cancelado",
  email_change_requested: "Troca de e-mail solicitada",
  email_changed: "E-mail trocado",
  email_change_reverted: "Troca de e-mail revertida",
  account_deleted: "Conta excluída",
  invite_accepted: "Convite aceito",
  team_left: "Saída de time",
  impersonate_started: "Impersonate iniciado",
  session_revoked: "Sessão encerrada",
  reputation_policy_updated: "Régua de reputação alterada",
  reputation_team_viewed: "Ficha de reputação consultada",
  reputation_team_blocked: "Envios bloqueados por reputação",
  reputation_team_unblocked: "Envios desbloqueados",
  reputation_team_supervised: "Liberação assistida concedida",
  reputation_team_exempted: "Time isentado do controle de bounce",
};
