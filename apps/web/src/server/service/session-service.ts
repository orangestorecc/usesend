import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import type { NextResponse } from "next/server";

import { db } from "~/server/db";
import { env } from "~/env";
import { aplicarGateDeMfaNaSessao } from "~/server/service/mfa-service";

// Docker builds pulam a validação de env, então NEXTAUTH_URL pode faltar aqui
// enquanto o Next coleta as rotas.
const isSecure = env.NEXTAUTH_URL?.startsWith("https") ?? false;

/** Os mesmos nomes/atributos que o NextAuth usa para o cookie de sessão. */
export const SESSION_COOKIE = isSecure
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

/** Atributos padrão de todo cookie que nasce junto com uma sessão. */
export function opcoesDeCookie(expires?: Date) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    ...(expires ? { expires } : {}),
  };
}

/**
 * Cria uma sessão fora do NextAuth e grava o cookie na resposta.
 *
 * Existe porque há DUAS portas que criam sessão sem passar pelo adapter
 * (resgate de link de acesso e impersonation de admin) e cada uma montava
 * `session.create` + `cookies.set` à mão, com sua própria cópia do nome e das
 * flags do cookie. Uma delas — a de impersonation — tinha esquecido o gate de
 * MFA. Regra duplicada é regra que some de uma das portas.
 */
export async function criarSessaoEGravarCookie(
  userId: number,
  res: NextResponse,
  {
    expires,
    accessLinkTeamId = null,
    aoCriar,
  }: {
    expires: Date;
    /** Preenchido só no link de acesso: prende a sessão ao time emissor. */
    accessLinkTeamId?: number | null;
    /** Roda na MESMA transação da criação da sessão (auditoria, por ex.). */
    aoCriar?: (
      _tx: Prisma.TransactionClient,
      _sessionToken: string,
    ) => Promise<void>;
  },
): Promise<string> {
  const sessionToken = randomBytes(32).toString("hex");

  await db.$transaction(async (tx) => {
    await tx.session.create({
      data: { sessionToken, userId, expires, accessLinkTeamId },
    });
    await aoCriar?.(tx, sessionToken);
  });

  // Fail-closed: se o desafio não puder ser criado, a sessão existe mas não
  // passa pelo `avaliarGate`.
  await aplicarGateDeMfaNaSessao(sessionToken, userId);

  res.cookies.set(SESSION_COOKIE, sessionToken, opcoesDeCookie(expires));

  return sessionToken;
}
