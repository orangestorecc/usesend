import { randomBytes, timingSafeEqual } from "crypto";
import { TRPCError } from "@trpc/server";

import { db } from "~/server/db";
import { env } from "~/env";
import { registrarAuditoria } from "~/server/service/audit-service";
import {
  consumirCodigo,
  emitirCodigo,
  gerarCodigo,
  hmacDoCodigo,
  MAX_TENTATIVAS,
} from "~/server/service/security-code-service";
import {
  enviarAvisoDeMfa,
  enviarCodigoDeSeguranca,
} from "~/server/service/security-mailer";
import {
  estaTravado,
  registrarFalhaDeCodigo,
} from "~/server/service/rate-limit-service";

export const MFA_DESAFIO_TTL_MINUTOS = 10;
export const QTD_RECOVERY_CODES = 10;

export function mfaHabilitado(): boolean {
  return env.MFA_ENABLED === "true" || env.MFA_ENABLED === "1";
}

/**
 * Cria o desafio da sessão recém-nascida. Um desafio por `sessionToken`:
 * verificar num dispositivo nunca libera outro.
 */
export async function criarDesafioDeMfa(
  sessionToken: string,
  userId: number,
  email: string,
): Promise<void> {
  const codigo = gerarCodigo();

  await db.mfaChallenge.upsert({
    where: { sessionToken },
    create: {
      sessionToken,
      codeHmac: hmacDoCodigo(codigo),
      expiresAt: new Date(Date.now() + MFA_DESAFIO_TTL_MINUTOS * 60 * 1000),
    },
    update: {
      codeHmac: hmacDoCodigo(codigo),
      attempts: 0,
      expiresAt: new Date(Date.now() + MFA_DESAFIO_TTL_MINUTOS * 60 * 1000),
    },
  });

  await enviarCodigoDeSeguranca(
    email,
    codigo,
    "concluir o login com Google ou GitHub",
  );
}

export type EstadoDoGate =
  | { liberado: true }
  | { liberado: false; motivo: "mfa_pendente" | "conta_excluida" };

/**
 * Gate fail-closed: qualquer dúvida sobre o estado da sessão bloqueia. Sem
 * isso, um erro de leitura viraria acesso liberado.
 */
export async function avaliarGate(sessionToken: string | null): Promise<EstadoDoGate> {
  // Sem token não dá para avaliar nada. Com o MFA desligado isso não deve
  // bloquear o produto inteiro, mas com ele ligado a omissão tem que barrar.
  if (!sessionToken) {
    return mfaHabilitado()
      ? { liberado: false, motivo: "mfa_pendente" }
      : { liberado: true };
  }

  const sessao = await db.session.findUnique({
    where: { sessionToken },
    select: {
      mfaVerifiedAt: true,
      user: { select: { mfaEnabled: true, deletedAt: true } },
    },
  });

  if (!sessao) {
    return mfaHabilitado()
      ? { liberado: false, motivo: "mfa_pendente" }
      : { liberado: true };
  }

  // Conta excluída barra sempre, independente da flag de MFA: sessão em voo
  // não pode continuar operando depois do delete.
  if (sessao.user.deletedAt) return { liberado: false, motivo: "conta_excluida" };

  if (!mfaHabilitado()) return { liberado: true };
  if (!sessao.user.mfaEnabled) return { liberado: true };
  if (sessao.mfaVerifiedAt) return { liberado: true };

  return { liberado: false, motivo: "mfa_pendente" };
}

/** Verificação do desafio. Erra 10 vezes por hora ⇒ 15 min de lockout. */
export async function verificarDesafio(
  sessionToken: string,
  codigo: string,
): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const desafio = await db.mfaChallenge.findUnique({ where: { sessionToken } });
  if (!desafio) return { ok: false, mensagem: "Nenhum código pendente." };

  const chave = `mfa:${sessionToken}`;
  if (await estaTravado(chave)) {
    return {
      ok: false,
      mensagem: "Muitas tentativas. Tente de novo em 15 minutos.",
    };
  }

  if (desafio.expiresAt.getTime() < Date.now()) {
    return { ok: false, mensagem: "O código expirou. Peça um novo." };
  }
  if (desafio.attempts >= MAX_TENTATIVAS) {
    return { ok: false, mensagem: "Muitas tentativas. Peça um código novo." };
  }

  const informado = Buffer.from(hmacDoCodigo(codigo), "utf8");
  const guardado = Buffer.from(desafio.codeHmac, "utf8");
  const confere =
    informado.length === guardado.length && timingSafeEqual(informado, guardado);

  if (!confere) {
    await db.mfaChallenge.update({
      where: { id: desafio.id },
      data: { attempts: { increment: 1 } },
    });
    await registrarFalhaDeCodigo(chave);
    return { ok: false, mensagem: "Código incorreto." };
  }

  await db.$transaction(async (tx) => {
    await tx.session.update({
      where: { sessionToken },
      data: { mfaVerifiedAt: new Date(), elevatedAt: new Date() },
    });
    await tx.mfaChallenge.delete({ where: { id: desafio.id } });
  });

  return { ok: true };
}

/** Recovery code entra no mesmo lockout do código por e-mail. */
export async function usarRecoveryCode(
  sessionToken: string,
  userId: number,
  codigo: string,
): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const chave = `mfa:${sessionToken}`;
  if (await estaTravado(chave)) {
    return {
      ok: false,
      mensagem: "Muitas tentativas. Tente de novo em 15 minutos.",
    };
  }

  const alvo = await db.mfaRecoveryCode.findFirst({
    where: { userId, usedAt: null, codeHmac: hmacDoCodigo(codigo) },
  });

  if (!alvo) {
    await registrarFalhaDeCodigo(chave);
    return { ok: false, mensagem: "Código de recuperação inválido." };
  }

  await db.$transaction(async (tx) => {
    // Uso único garantido pelo `usedAt: null` no where.
    const usado = await tx.mfaRecoveryCode.updateMany({
      where: { id: alvo.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (usado.count === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Código de recuperação já utilizado.",
      });
    }
    await tx.session.update({
      where: { sessionToken },
      data: { mfaVerifiedAt: new Date(), elevatedAt: new Date() },
    });
    await tx.mfaChallenge.deleteMany({ where: { sessionToken } });
  });

  return { ok: true };
}

/**
 * Ativação: o código nunca é dispensado pela sessão elevada. A prova de
 * recebimento é pré-requisito funcional — sem ela, ligar o MFA pode trancar
 * a pessoa fora da conta no próximo login social.
 */
export async function pedirCodigoDeAtivacao(userId: number, email: string) {
  const codigo = await emitirCodigo(userId, "MFA_ENABLE");
  await enviarCodigoDeSeguranca(
    email,
    codigo,
    "ativar a confirmação por e-mail em logins sociais",
  );
}

export async function ativarMfa(
  userId: number,
  codigo: string,
  contexto: { email: string; ip?: string | null; userAgent?: string | null },
): Promise<{ recoveryCodes: string[] }> {
  const r = await consumirCodigo(userId, "MFA_ENABLE", codigo);
  if (!r.ok) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Código inválido ou expirado." });
  }

  const codes = Array.from({ length: QTD_RECOVERY_CODES }, () =>
    randomBytes(5).toString("hex"),
  );

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaEnabledAt: new Date() },
    });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({
      data: codes.map((c) => ({ userId, codeHmac: hmacDoCodigo(c) })),
    });
    await registrarAuditoria(
      "mfa_enabled",
      {
        actorUserId: userId,
        targetUserId: userId,
        targetEmail: contexto.email,
        ip: contexto.ip,
        userAgent: contexto.userAgent,
      },
      tx,
    );
  });

  await enviarAvisoDeMfa(contexto.email, true);

  // Exibidos uma única vez — não há como recuperá-los depois.
  return { recoveryCodes: codes };
}

export async function desativarMfa(
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
    const r = await consumirCodigo(userId, "MFA_ENABLE", contexto.codigo ?? "");
    if (!r.ok) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Código inválido ou expirado.",
      });
    }
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaEnabledAt: null },
    });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await registrarAuditoria(
      "mfa_disabled",
      {
        actorUserId: userId,
        targetUserId: userId,
        targetEmail: contexto.email,
        ip: contexto.ip,
        userAgent: contexto.userAgent,
      },
      tx,
    );
  });

  await enviarAvisoDeMfa(contexto.email, false);
}
