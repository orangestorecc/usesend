import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";

import { db } from "~/server/db";
import { env } from "~/env";
import { registrarAuditoria } from "~/server/service/audit-service";
import {
  consumirCodigo,
  emitirCodigo,
} from "~/server/service/security-code-service";
import {
  enviarAvisoDeTrocaDeEmail,
  enviarCodigoDeSeguranca,
} from "~/server/service/security-mailer";

/** Janela de reversão: 7 dias (decisão #3 da consolidação). */
export const REVERSAO_DIAS = 7;

function prazoDeReversao(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + REVERSAO_DIAS * 24 * 60 * 60 * 1000);
}

export function urlDeReversao(token: string): string {
  const base = env.NEXTAUTH_URL ?? "";
  // Fora do dashboard de propósito: a reversão derruba todas as sessões, e
  // quem clica no link normalmente não está logado.
  return `${base}/reverter-email?token=${token}`;
}

/** Troca em andamento na janela de reversão bloqueia nova troca e exclusão. */
export async function trocaNaJanelaDeReversao(userId: number) {
  return db.emailChangeRequest.findFirst({
    where: {
      userId,
      committedAt: { not: null },
      revertedAt: null,
      revertDeadline: { gt: new Date() },
    },
  });
}

/** Passo 1 — código ao e-mail atual (pulado quando a sessão está elevada). */
export async function iniciarTrocaDeEmail(userId: number, emailAtual: string) {
  if (await trocaNaJanelaDeReversao(userId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Há uma troca de e-mail recente ainda no prazo de reversão. Aguarde o prazo terminar.",
    });
  }

  const codigo = await emitirCodigo(userId, "EMAIL_CHANGE_CURRENT");
  await enviarCodigoDeSeguranca(
    emailAtual,
    codigo,
    "confirmar que é você quem está trocando o e-mail da conta",
  );
}

/** Passo 2 — com o e-mail atual provado, registra o destino e manda o código novo. */
export async function pedirCodigoDoEmailNovo(
  userId: number,
  emailNovo: string,
  opcoes: { codigoAtual?: string; sessaoElevada: boolean },
) {
  const alvo = emailNovo.trim().toLowerCase();

  if (!opcoes.sessaoElevada) {
    const r = await consumirCodigo(
      userId,
      "EMAIL_CHANGE_CURRENT",
      opcoes.codigoAtual ?? "",
    );
    if (!r.ok) {
      throw new TRPCError({ code: "FORBIDDEN", message: mensagemDoErro(r) });
    }
  }

  const jaExiste = await db.user.findFirst({
    where: { email: { equals: alvo, mode: "insensitive" } },
  });
  if (jaExiste) {
    // Mesma resposta genérica para e-mail livre e ocupado seria pior aqui: a
    // pessoa precisa saber que aquele endereço não serve.
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este e-mail já está em uso em outra conta",
    });
  }

  const usuario = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const pedido = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { pendingEmail: alvo },
    });

    // Pedidos anteriores não confirmados morrem: dois destinos válidos ao
    // mesmo tempo é ambiguidade que vira bug de conta trocada.
    await tx.emailChangeRequest.deleteMany({
      where: { userId, committedAt: null },
    });

    return tx.emailChangeRequest.create({
      data: {
        userId,
        oldEmail: usuario.email ?? "",
        newEmail: alvo,
        currentConfirmedAt: new Date(),
        revertToken: randomBytes(32).toString("hex"),
      },
    });
  });

  const codigo = await emitirCodigo(userId, "EMAIL_CHANGE_NEW", {
    sentTo: alvo,
  });
  await enviarCodigoDeSeguranca(
    alvo,
    codigo,
    "confirmar este endereço como novo e-mail de acesso da sua conta Madmail",
  );

  return { pedidoId: pedido.id, emailNovo: alvo };
}

/**
 * Passo 3 — código ao e-mail novo. Nunca dispensado pela sessão elevada: sem
 * prova de recebimento, a pessoa pode se trancar fora da própria conta.
 */
export async function confirmarTrocaDeEmail(
  userId: number,
  codigo: string,
  contexto: { ip?: string | null; userAgent?: string | null; sessionToken?: string | null },
) {
  const r = await consumirCodigo(userId, "EMAIL_CHANGE_NEW", codigo);
  if (!r.ok) {
    throw new TRPCError({ code: "FORBIDDEN", message: mensagemDoErro(r) });
  }

  const pedido = await db.emailChangeRequest.findFirst({
    where: { userId, committedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!pedido) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Nenhuma troca de e-mail em andamento",
    });
  }

  const deadline = prazoDeReversao();

  await db.$transaction(async (tx) => {
    // Snapshot das contas OAuth de agora: a reversão remove o que for
    // vinculado depois, e isso precisa vir de estado, não do log.
    const contas = await tx.account.findMany({
      where: { userId },
      select: { provider: true, providerAccountId: true },
    });

    await tx.user.update({
      where: { id: userId },
      data: { email: pedido.newEmail, pendingEmail: null, emailVerified: new Date() },
    });

    await tx.emailChangeRequest.update({
      where: { id: pedido.id },
      data: {
        newConfirmedAt: new Date(),
        committedAt: new Date(),
        revertDeadline: deadline,
        oauthAccountsSnapshot: contas,
      },
    });

    // Derruba as outras sessões, preservando a atual — trocar o e-mail não
    // pode expulsar quem acabou de provar as duas caixas.
    await tx.session.deleteMany({
      where: {
        userId,
        ...(contexto.sessionToken
          ? { sessionToken: { not: contexto.sessionToken } }
          : {}),
      },
    });

    await registrarAuditoria(
      "email_changed",
      {
        actorUserId: userId,
        actorEmail: pedido.newEmail,
        targetUserId: userId,
        targetEmail: pedido.newEmail,
        ip: contexto.ip,
        userAgent: contexto.userAgent,
        metadata: { de: pedido.oldEmail, para: pedido.newEmail },
      },
      tx,
    );
  });

  await enviarAvisoDeTrocaDeEmail(
    pedido.oldEmail,
    pedido.newEmail,
    urlDeReversao(pedido.revertToken),
    deadline,
  );

  return { email: pedido.newEmail };
}

/**
 * Reversão pelo link enviado ao e-mail antigo. Volta o e-mail, derruba TODAS
 * as sessões e remove as contas OAuth vinculadas depois da troca.
 */
export async function reverterTrocaDeEmail(token: string) {
  const pedido = await db.emailChangeRequest.findUnique({
    where: { revertToken: token },
  });

  if (
    !pedido ||
    pedido.revertedAt ||
    !pedido.committedAt ||
    !pedido.revertDeadline ||
    pedido.revertDeadline.getTime() < Date.now()
  ) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Link de reversão inválido ou expirado",
    });
  }

  const snapshot = (pedido.oauthAccountsSnapshot ?? []) as Array<{
    provider: string;
    providerAccountId: string;
  }>;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: pedido.userId },
      data: { email: pedido.oldEmail, pendingEmail: null },
    });

    const contasAgora = await tx.account.findMany({
      where: { userId: pedido.userId },
      select: { id: true, provider: true, providerAccountId: true },
    });

    const vinculadasDepois = contasAgora.filter(
      (c) =>
        !snapshot.some(
          (s) =>
            s.provider === c.provider &&
            s.providerAccountId === c.providerAccountId,
        ),
    );
    if (vinculadasDepois.length > 0) {
      await tx.account.deleteMany({
        where: { id: { in: vinculadasDepois.map((c) => c.id) } },
      });
    }

    await tx.session.deleteMany({ where: { userId: pedido.userId } });

    await tx.emailChangeRequest.update({
      where: { id: pedido.id },
      data: { revertedAt: new Date() },
    });

    await registrarAuditoria(
      "email_change_reverted",
      {
        targetUserId: pedido.userId,
        targetEmail: pedido.oldEmail,
        metadata: {
          de: pedido.newEmail,
          para: pedido.oldEmail,
          contasRemovidas: vinculadasDepois.length,
        },
      },
      tx,
    );
  });

  return { email: pedido.oldEmail };
}

function mensagemDoErro(r: { ok: false; motivo: string }): string {
  switch (r.motivo) {
    case "expirado":
      return "O código expirou. Peça um novo.";
    case "excedido":
      return "Muitas tentativas. Peça um código novo.";
    case "inexistente":
      return "Nenhum código pendente. Peça um novo.";
    default:
      return "Código incorreto.";
  }
}
