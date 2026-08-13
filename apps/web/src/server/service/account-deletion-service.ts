import { TRPCError } from "@trpc/server";

import { db } from "~/server/db";
import { env } from "~/env";
import {
  anonimizarAuditoriaDoUsuario,
  registrarAuditoria,
} from "~/server/service/audit-service";
import {
  consumirCodigo,
  emitirCodigo,
} from "~/server/service/security-code-service";
import { enviarCodigoDeSeguranca } from "~/server/service/security-mailer";
import { trocaNaJanelaDeReversao } from "~/server/service/email-change-service";

/**
 * Namespace do advisory lock do ciclo de vida do usuário. Exclusão e aceite
 * de convite disputam o mesmo estado; sem a lock, aceitar um convite durante
 * o delete deixaria um vínculo órfão.
 */
export const LOCK_NS_USER_LIFECYCLE = 4711;

/** Linha pseudonimizada some de vez depois de 30 dias, por job. */
export const DIAS_ATE_HARD_DELETE = 30;

export type Bloqueio =
  | { tipo: "time"; teamId: number; nome: string; ehAdmin: boolean; ultimoAdmin: boolean }
  | { tipo: "troca_de_email"; ate: Date }
  | { tipo: "assinatura_ativa" };

/**
 * Pré-condições da exclusão. Devolvidas como lista para o dialog abrir em
 * modo checklist e resolver tudo sem sair dele.
 */
export async function listarBloqueios(userId: number): Promise<Bloqueio[]> {
  const bloqueios: Bloqueio[] = [];

  const vinculos = await db.teamUser.findMany({
    where: { userId },
    include: { team: { select: { id: true, name: true } } },
  });

  for (const v of vinculos) {
    const admins = await db.teamUser.count({
      where: { teamId: v.teamId, role: "ADMIN" },
    });
    bloqueios.push({
      tipo: "time",
      teamId: v.teamId,
      nome: v.team.name,
      ehAdmin: v.role === "ADMIN",
      ultimoAdmin: v.role === "ADMIN" && admins <= 1,
    });
  }

  const troca = await trocaNaJanelaDeReversao(userId);
  if (troca?.revertDeadline) {
    bloqueios.push({ tipo: "troca_de_email", ate: troca.revertDeadline });
  }

  if (env.NEXT_PUBLIC_IS_CLOUD) {
    const assinatura = await db.subscription.findFirst({
      where: {
        team: { teamUsers: { some: { userId } } },
        status: { in: ["active", "trialing", "past_due"] },
      },
    });
    if (assinatura) bloqueios.push({ tipo: "assinatura_ativa" });
  }

  return bloqueios;
}

export async function pedirCodigoDeExclusao(userId: number, email: string) {
  const codigo = await emitirCodigo(userId, "ACCOUNT_DELETE");
  await enviarCodigoDeSeguranca(email, codigo, "excluir sua conta Madmail");
}

/**
 * Exclusão. Pseudonimiza em vez de apagar na hora: o resíduo é tratado como
 * dado pessoal, com base legal documentada (LGPD art. 7º IX e 10) e hard
 * delete em 30 dias.
 */
export async function excluirConta(
  userId: number,
  contexto: {
    email: string;
    codigo?: string;
    sessaoElevada: boolean;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<void> {
  if (!contexto.sessaoElevada) {
    const r = await consumirCodigo(
      userId,
      "ACCOUNT_DELETE",
      contexto.codigo ?? "",
    );
    if (!r.ok) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Código inválido ou expirado.",
      });
    }
  }

  await db.$transaction(async (tx) => {
    // A lock fecha o TOCTOU com o aceite de convite: quem chegar depois
    // espera, e encontra a conta já marcada como excluída.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NS_USER_LIFECYCLE}, hashtext(${String(
      userId,
    )}))`;

    const bloqueios = await listarBloqueiosNaTransacao(tx, userId);
    if (bloqueios.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Ainda há pendências que impedem a exclusão.",
      });
    }

    const usuario = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subjectId: true, email: true },
    });

    // Audit ANTES de destruir: se gravasse depois, um erro no meio deixaria
    // a conta destruída e o evento sem registro.
    await registrarAuditoria(
      "account_deleted",
      {
        actorUserId: userId,
        actorEmail: usuario.email,
        targetUserId: userId,
        targetSubject: usuario.subjectId,
        targetEmail: usuario.email,
        ip: contexto.ip,
        userAgent: contexto.userAgent,
      },
      tx,
    );

    await tx.account.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.securityCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    if (usuario.email) {
      await tx.teamInvite.deleteMany({
        where: { email: { equals: usuario.email, mode: "insensitive" } },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${usuario.subjectId}@madmail.invalid`,
        name: null,
        image: null,
        pendingEmail: null,
        mfaEnabled: false,
        mfaEnabledAt: null,
        deletedAt: new Date(),
      },
    });

    await anonimizarAuditoriaDoUsuario(userId, tx);
  });
}

async function listarBloqueiosNaTransacao(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: number,
) {
  const vinculos = await tx.teamUser.count({ where: { userId } });
  const bloqueios: string[] = [];
  if (vinculos > 0) bloqueios.push("time");

  const troca = await tx.emailChangeRequest.findFirst({
    where: {
      userId,
      committedAt: { not: null },
      revertedAt: null,
      revertDeadline: { gt: new Date() },
    },
  });
  if (troca) bloqueios.push("troca_de_email");

  return bloqueios;
}

/** Hard delete das contas pseudonimizadas há mais de 30 dias. Roda por job. */
export async function purgarContasExcluidas(
  agora: Date = new Date(),
): Promise<number> {
  const corte = new Date(
    agora.getTime() - DIAS_ATE_HARD_DELETE * 24 * 60 * 60 * 1000,
  );
  const { count } = await db.user.deleteMany({
    where: { deletedAt: { lt: corte } },
  });
  return count;
}
