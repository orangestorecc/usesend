import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";

import { db } from "~/server/db";
import { env } from "~/env";
import { registrarAuditoria } from "~/server/service/audit-service";
import { sendMail } from "~/server/mailer";
import { logger } from "~/server/logger/log";

/**
 * Reset de MFA pelo suporte existe porque a alternativa é lockout
 * irrecuperável. Como é engenharia social em potencial, tem três freios:
 * duas pessoas diferentes, 72h de espera e cancelamento pelo próprio dono.
 */
export const COOLDOWN_HORAS = 72;

function urlDeCancelamento(token: string): string {
  return `${env.NEXTAUTH_URL ?? ""}/cancelar-reset-mfa?token=${token}`;
}

export async function solicitarResetDeMfa(
  userId: number,
  requestedBy: string,
): Promise<void> {
  const usuario = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, subjectId: true, mfaEnabled: true },
  });

  if (!usuario.mfaEnabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Esta conta não tem confirmação por e-mail ativada",
    });
  }

  const pendente = await db.mfaResetRequest.findFirst({
    where: { userId, executedAt: null, canceledAt: null },
  });
  if (pendente) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Já existe um reset pendente para esta conta",
    });
  }

  const cancelToken = randomBytes(32).toString("hex");
  const executesAt = new Date(Date.now() + COOLDOWN_HORAS * 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    await tx.mfaResetRequest.create({
      data: { userId, requestedBy, cancelToken, executesAt },
    });
    await registrarAuditoria(
      "mfa_reset_requested",
      {
        actorEmail: requestedBy,
        targetUserId: userId,
        targetSubject: usuario.subjectId,
        targetEmail: usuario.email,
        metadata: { executesAt: executesAt.toISOString() },
      },
      tx,
    );
  });

  // O dono é avisado sempre — é ele quem tem o poder de barrar.
  if (usuario.email) {
    const texto = `Olá,\n\nO suporte da Madmail recebeu um pedido para desativar a confirmação por e-mail da sua conta.\n\nSe foi você quem pediu, não precisa fazer nada: a mudança acontece em ${COOLDOWN_HORAS} horas.\n\nSe NÃO foi você, cancele agora:\n${urlDeCancelamento(cancelToken)}\n\nMadmail`;
    try {
      await sendMail(
        usuario.email,
        "Pedido de desativação da confirmação por e-mail",
        texto,
        texto.replace(/\n/g, "<br />"),
        undefined,
        env.FROM_EMAIL,
      );
    } catch (err) {
      logger.error({ err }, "Falha ao avisar dono sobre reset de MFA");
    }
  }
}

/**
 * Aprovação: precisa ser outra pessoa. Um suporte que pede e aprova sozinho
 * não é two-person rule nenhuma.
 */
export async function aprovarResetDeMfa(
  requestId: string,
  approvedBy: string,
): Promise<void> {
  const pedido = await db.mfaResetRequest.findUnique({
    where: { id: requestId },
  });

  if (!pedido || pedido.canceledAt || pedido.executedAt) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
  }

  if (pedido.requestedBy.toLowerCase() === approvedBy.toLowerCase()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A aprovação precisa vir de outra pessoa do suporte",
    });
  }

  await db.mfaResetRequest.update({
    where: { id: requestId },
    data: { approvedBy },
  });
}

export async function cancelarResetDeMfa(token: string): Promise<void> {
  const pedido = await db.mfaResetRequest.findUnique({
    where: { cancelToken: token },
  });

  if (!pedido || pedido.canceledAt || pedido.executedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Pedido inválido ou já resolvido",
    });
  }

  await db.$transaction(async (tx) => {
    await tx.mfaResetRequest.update({
      where: { id: pedido.id },
      data: { canceledAt: new Date() },
    });
    await registrarAuditoria(
      "mfa_reset_canceled",
      { targetUserId: pedido.userId, metadata: { requestId: pedido.id } },
      tx,
    );
  });
}

/**
 * Executa os pedidos aprovados cujo cooldown venceu. Roda no job diário —
 * executar na hora da aprovação anularia as 72h.
 */
export async function executarResetsVencidos(
  agora: Date = new Date(),
): Promise<number> {
  const pendentes = await db.mfaResetRequest.findMany({
    where: {
      canceledAt: null,
      executedAt: null,
      approvedBy: { not: null },
      executesAt: { lte: agora },
    },
  });

  for (const pedido of pendentes) {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: pedido.userId },
        data: { mfaEnabled: false, mfaEnabledAt: null },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: pedido.userId } });
      await tx.mfaResetRequest.update({
        where: { id: pedido.id },
        data: { executedAt: new Date() },
      });
      await registrarAuditoria(
        "mfa_reset_executed",
        {
          actorEmail: pedido.approvedBy,
          targetUserId: pedido.userId,
          metadata: { requestId: pedido.id, requestedBy: pedido.requestedBy },
        },
        tx,
      );
    });
  }

  return pendentes.length;
}
