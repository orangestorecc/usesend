import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "~/server/db";

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
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

/** Eventos destrutivos ganham badge vermelha na tela do administrador. */
export const AUDIT_EVENTOS_DESTRUTIVOS: AuditEvent[] = [
  "account_deleted",
  "mfa_disabled",
  "mfa_reset_executed",
  "team_left",
];

/** Auditoria fica 12 meses; depois disso o purge apaga. */
export const AUDIT_RETENCAO_MESES = 12;

export type AuditContexto = {
  actorUserId?: number | null;
  actorEmail?: string | null;
  targetUserId?: number | null;
  targetSubject?: string | null;
  targetEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type Cliente = PrismaClient | Prisma.TransactionClient;

/**
 * Grava o evento. Passar o cliente da transação é o caminho normal: a spec
 * exige que a operação aborte se o log falhar, e isso só vale se os dois
 * estiverem na mesma transação.
 */
export async function registrarAuditoria(
  event: AuditEvent,
  contexto: AuditContexto,
  cliente: Cliente = db,
): Promise<void> {
  await cliente.userAuditLog.create({
    data: {
      event,
      actorUserId: contexto.actorUserId ?? null,
      actorEmail: contexto.actorEmail ?? null,
      targetUserId: contexto.targetUserId ?? null,
      targetSubject: contexto.targetSubject ?? null,
      targetEmail: contexto.targetEmail ?? null,
      ip: contexto.ip ?? null,
      userAgent: contexto.userAgent ?? null,
      metadata: contexto.metadata,
    },
  });
}

/**
 * Zera o e-mail em snapshot nos logs de um usuário pseudonimizado. A
 * correlação continua viva pelo `targetSubject`, que é aleatório e não
 * identifica ninguém sozinho.
 */
export async function anonimizarAuditoriaDoUsuario(
  userId: number,
  cliente: Cliente = db,
): Promise<void> {
  await cliente.userAuditLog.updateMany({
    where: { targetUserId: userId },
    data: { targetEmail: null, actorEmail: null, ip: null, userAgent: null },
  });
}

/** Purge da retenção de 12 meses. Chamado por job. */
export async function purgarAuditoriaAntiga(
  agora: Date = new Date(),
  cliente: Cliente = db,
): Promise<number> {
  const corte = new Date(agora);
  corte.setMonth(corte.getMonth() - AUDIT_RETENCAO_MESES);
  const { count } = await cliente.userAuditLog.deleteMany({
    where: { createdAt: { lt: corte } },
  });
  return count;
}
