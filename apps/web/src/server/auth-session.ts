import type { Prisma, PrismaClient, Session } from "@prisma/client";

import { db } from "~/server/db";

/**
 * Os dois nomes que o NextAuth usa para o cookie de sessão: o prefixo
 * `__Secure-` só aparece quando a URL é https. Ler só um dos dois quebra em
 * um dos ambientes.
 */
const NOMES_DO_COOKIE = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

export function lerSessionTokenDoCookie(headers: Headers): string | null {
  const cru = headers.get("cookie");
  if (!cru) return null;

  for (const parte of cru.split(";")) {
    const [nome, ...resto] = parte.trim().split("=");
    if (nome && NOMES_DO_COOKIE.includes(nome)) {
      return decodeURIComponent(resto.join("="));
    }
  }
  return null;
}

/**
 * A row de `Session` da requisição atual. Precisa existir porque o estado de
 * MFA e de sessão elevada vive na row — e porque "encerrar as outras sessões"
 * exige saber qual é a atual para preservá-la.
 */
export async function getCurrentSessionRow(
  headers: Headers,
  cliente: PrismaClient | Prisma.TransactionClient = db,
): Promise<Session | null> {
  const token = lerSessionTokenDoCookie(headers);
  if (!token) return null;
  return cliente.session.findUnique({ where: { sessionToken: token } });
}

/** Sessão elevada vale 10 minutos. */
export const ELEVACAO_MINUTOS = 10;

export function sessaoElevada(
  session: Pick<Session, "elevatedAt"> | null,
  agora: Date = new Date(),
): boolean {
  if (!session?.elevatedAt) return false;
  return (
    agora.getTime() - session.elevatedAt.getTime() <
    ELEVACAO_MINUTOS * 60 * 1000
  );
}
