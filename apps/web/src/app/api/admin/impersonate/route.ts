import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env";
import { ehAdminDaPlataformaPorId } from "~/server/service/platform-admin";
import { lerTravaDeLinkDeAcesso } from "~/server/service/active-team";
import {
  SESSION_COOKIE,
  criarSessaoEGravarCookie,
  opcoesDeCookie,
} from "~/server/service/session-service";

const IMPERSONATOR_COOKIE = "madmail-impersonator";

/**
 * Admin "entrar na conta do cliente" (impersonation).
 * Cria uma sessão para um usuário do time e troca o cookie de sessão,
 * guardando o token do admin para permitir voltar depois.
 */
export async function GET(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user || !(await ehAdminDaPlataformaPorId(session.user.id))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  // Esta é a ÚNICA rota fora do tRPC que fabrica uma sessão nova, então é
  // também a única porta por onde a trava de link de acesso poderia ser
  // lavada: sessão presa a um workspace entrava aqui e saía com uma sessão
  // limpa (sem `accessLinkTeamId`) para qualquer time. Ser admin de plataforma
  // não desfaz a trava — quem quiser impersonar entra pela própria conta.
  if ((await lerTravaDeLinkDeAcesso(req.headers, db)) !== null) {
    return NextResponse.json(
      { error: "Este acesso está limitado a um workspace" },
      { status: 403 },
    );
  }

  const teamId = Number(new URL(req.url).searchParams.get("teamId"));
  if (!teamId) {
    return NextResponse.json({ error: "teamId obrigatório" }, { status: 400 });
  }

  // `orderBy` explícito: sem ele o banco escolhe um membro arbitrário e a
  // mesma URL entra em contas diferentes entre um request e outro. O menor
  // `userId` do time é o alvo estável.
  const teamUser =
    (await db.teamUser.findFirst({
      where: { teamId, role: "ADMIN" },
      orderBy: { userId: "asc" },
    })) ??
    (await db.teamUser.findFirst({
      where: { teamId },
      orderBy: { userId: "asc" },
    }));

  if (!teamUser) {
    return NextResponse.json(
      { error: "Nenhum usuário neste cliente" },
      { status: 404 },
    );
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value;

  const res = NextResponse.redirect(new URL("/dashboard", env.NEXTAUTH_URL));
  if (currentToken) {
    res.cookies.set(IMPERSONATOR_COOKIE, currentToken, opcoesDeCookie());
  }

  // Mesmo caminho de criação de sessão do resgate de link de acesso. Isto passa
  // a aplicar o gate de MFA também aqui: entrar na conta de um cliente que tem
  // MFA ligado exige o código dele, como já exigia por qualquer outra porta.
  await criarSessaoEGravarCookie(teamUser.userId, res, {
    expires: new Date(Date.now() + 60 * 60 * 1000),
  });

  return res;
}
