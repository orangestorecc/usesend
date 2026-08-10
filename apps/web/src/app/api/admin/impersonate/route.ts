import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env";

const isSecure = env.NEXTAUTH_URL.startsWith("https");
const SESSION_COOKIE = isSecure
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";
const IMPERSONATOR_COOKIE = "madmail-impersonator";

/**
 * Admin "entrar na conta do cliente" (impersonation).
 * Cria uma sessão para um usuário do time e troca o cookie de sessão,
 * guardando o token do admin para permitir voltar depois.
 */
export async function GET(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user || session.user.email !== env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const teamId = Number(new URL(req.url).searchParams.get("teamId"));
  if (!teamId) {
    return NextResponse.json({ error: "teamId obrigatório" }, { status: 400 });
  }

  const teamUser =
    (await db.teamUser.findFirst({
      where: { teamId, role: "ADMIN" },
    })) ?? (await db.teamUser.findFirst({ where: { teamId } }));

  if (!teamUser) {
    return NextResponse.json(
      { error: "Nenhum usuário neste cliente" },
      { status: 404 },
    );
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value;

  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      sessionToken: token,
      userId: teamUser.userId,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const res = NextResponse.redirect(new URL("/dashboard", env.NEXTAUTH_URL));
  if (currentToken) {
    res.cookies.set(IMPERSONATOR_COOKIE, currentToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
    });
  }
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
