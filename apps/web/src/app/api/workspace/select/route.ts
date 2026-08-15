import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env";
import {
  WORKSPACE_COOKIE,
  WORKSPACE_COOKIE_MAX_AGE,
  lerTravaDeLinkDeAcesso,
  usuarioPertenceAoTime,
} from "~/server/service/active-team";

// Docker builds pulam a validação de env, então NEXTAUTH_URL pode faltar aqui
// enquanto o Next coleta as rotas.
const isSecure = env.NEXTAUTH_URL?.startsWith("https") ?? false;

const corpo = z.object({ teamId: z.number().int().positive() });

/**
 * Troca o workspace ativo da sessão.
 * O cookie só é gravado depois de confirmar o vínculo no banco — o valor é
 * revalidado a cada request mesmo assim (ver `resolverTimeAtivo`).
 */
export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = corpo.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "teamId inválido" }, { status: 400 });
  }

  const { teamId } = parsed.data;

  // Sessão nascida de link de acesso não troca de workspace, nem para um time
  // do qual o alvo realmente participa: era exatamente assim que um admin do
  // time emissor chegava ao outro workspace da pessoa.
  const presaAoTime = await lerTravaDeLinkDeAcesso(req.headers, db);
  if (presaAoTime !== null) {
    return NextResponse.json(
      {
        error:
          "Este acesso está limitado a um workspace. Entre pela sua própria conta para trocar.",
      },
      { status: 403 },
    );
  }

  const pertence = await usuarioPertenceAoTime(session.user.id, teamId, db);
  if (!pertence) {
    return NextResponse.json(
      { error: "Você não faz parte deste workspace" },
      { status: 403 },
    );
  }

  const res = NextResponse.json({ success: true, teamId });
  res.cookies.set(WORKSPACE_COOKIE, String(teamId), {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    // Sem `maxAge` isto virava cookie de sessão do browser: quem trabalha com
    // vários workspaces reescolhia o workspace toda vez que reabria o
    // navegador. 30 dias acompanha a validade da sessão do NextAuth; o valor
    // continua sendo revalidado contra o banco a cada request, então um cookie
    // velho nunca dá acesso a time do qual a pessoa saiu.
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  });
  return res;
}
