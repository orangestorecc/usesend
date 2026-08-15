import { NextResponse } from "next/server";

import { db } from "~/server/db";
import { env } from "~/env";
import { logger } from "~/server/logger/log";
import { registrarAuditoria } from "~/server/service/audit-service";
import {
  ACCESS_LINK_SESSAO_HORAS,
  consumirLinkDeAcesso,
} from "~/server/service/access-link-service";
import {
  criarSessaoEGravarCookie,
  opcoesDeCookie,
} from "~/server/service/session-service";
import { WORKSPACE_COOKIE } from "~/server/service/active-team";
import { sendAccessLinkRedeemedEmail } from "~/server/mailer";

/** Consumido pelo banner do dashboard. Só apresentação — ver comentário abaixo. */
const ACCESS_LINK_BANNER_COOKIE = "madmail-access-link";

function recusar(motivo: string) {
  const url = new URL("/login", env.NEXTAUTH_URL ?? "http://localhost:3000");
  url.searchParams.set("error", motivo);
  return NextResponse.redirect(url);
}

/**
 * Resgate do link de acesso. Porta de autenticação própria, e não o callback
 * do EmailProvider, porque a sessão precisa nascer PRESA ao time emissor:
 * `Session.accessLinkTeamId`. Com magic link a sessão era global e um admin
 * do time A alcançava o time B do mesmo alvo pelo seletor de workspace.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return recusar("access_link_invalido");
  }

  // Uso único sob corrida: update condicional, nunca read-then-write.
  const link = await consumirLinkDeAcesso(token);
  if (!link) {
    return recusar("access_link_invalido");
  }

  // O vínculo pode ter morrido entre a emissão e o clique (membro removido,
  // conta excluída). O link já está queimado de qualquer forma.
  const vinculo = await db.teamUser.findUnique({
    where: {
      teamId_userId: { teamId: link.teamId, userId: link.targetUserId },
    },
    select: {
      role: true,
      team: { select: { name: true } },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          subjectId: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!vinculo || vinculo.user.deletedAt) {
    logger.warn(
      { accessLinkId: link.id },
      "Link de acesso resgatado para vínculo inexistente ou conta excluída",
    );
    return recusar("access_link_invalido");
  }

  // O papel é reconferido AQUI, não só na emissão: entre gerar e clicar cabem
  // 30 minutos, e promover o alvo a ADMIN nessa janela entregaria justamente o
  // acesso que a política recusa emitir. (A promoção também derruba os links
  // pendentes; esta é a outra metade, para quem escrever no banco por fora.)
  if (vinculo.role === "ADMIN") {
    logger.warn(
      { accessLinkId: link.id },
      "Link de acesso resgatado para alvo que virou ADMIN depois da emissão",
    );
    return recusar("access_link_invalido");
  }

  const expires = new Date(
    Date.now() + ACCESS_LINK_SESSAO_HORAS * 60 * 60 * 1000,
  );

  const res = NextResponse.redirect(
    new URL("/dashboard", env.NEXTAUTH_URL ?? "http://localhost:3000"),
  );

  // Mesmo caminho de criação de sessão do impersonate: token, gate de MFA e
  // cookie saem de um lugar só.
  await criarSessaoEGravarCookie(link.targetUserId, res, {
    expires,
    accessLinkTeamId: link.teamId,
    aoCriar: async (tx) => {
      // Sem isto, numa investigação as ações do admin aparecem como ações da
      // vítima: a emissão era auditada, o uso não.
      await registrarAuditoria(
        "access_link_redeemed",
        {
          actorUserId: link.createdByUserId,
          targetUserId: link.targetUserId,
          targetSubject: vinculo.user.subjectId,
          targetEmail: vinculo.user.email,
          metadata: {
            teamId: link.teamId,
            accessLinkId: link.id,
            sessaoExpiraEm: expires.toISOString(),
          },
        },
        tx,
      );
    },
  });

  // Cosmético: a trava real é `accessLinkTeamId`, revalidada a cada request.
  res.cookies.set(
    WORKSPACE_COOKIE,
    String(link.teamId),
    opcoesDeCookie(expires),
  );
  // APRESENTAÇÃO E SÓ. Este cookie é a fonte única do banner e da prop
  // `acessoPresoAoWorkspace` (lidos em `src/app/(dashboard)/layout.tsx`).
  // Nenhuma decisão de acesso pode olhar para ele: a autoridade é a coluna
  // `Session.accessLinkTeamId`, revalidada no banco a cada request por
  // `lerTravaDeLinkDeAcesso`. Cookie o cliente apaga; a coluna, não.
  res.cookies.set(
    ACCESS_LINK_BANNER_COOKIE,
    encodeURIComponent(vinculo.team.name),
    opcoesDeCookie(expires),
  );

  await avisarDonoDaConta(link, vinculo);

  return res;
}

/**
 * Transparência: na variante "copiar link" o link nunca passa pela caixa de
 * entrada de quem tem a conta, então sem este aviso ela nunca fica sabendo que
 * alguém entrou. O envio é BEST-EFFORT — mailer fora do ar, sem domínio
 * verificado ou SES recusando não podem impedir o resgate, que a esta altura
 * já aconteceu (token queimado, sessão criada, auditoria gravada).
 */
async function avisarDonoDaConta(
  link: { id: string; teamId: number; createdByUserId: number },
  vinculo: {
    team: { name: string };
    user: { email: string | null; name?: string | null };
  },
) {
  try {
    if (!vinculo.user.email) return;

    const emissor = await db.user.findUnique({
      where: { id: link.createdByUserId },
      select: { name: true, email: true },
    });

    // Quem a pessoa reconhece é o nome; o e-mail cru é o fallback.
    const quemLiberou = emissor?.name ?? emissor?.email;
    if (!quemLiberou) return;

    await sendAccessLinkRedeemedEmail(vinculo.user.email, {
      quemLiberou,
      nomeDoWorkspace: vinculo.team.name,
      quando: new Date(),
      horasDeSessao: ACCESS_LINK_SESSAO_HORAS,
      nome: vinculo.user.name,
    });
  } catch (err) {
    logger.error(
      { err, accessLinkId: link.id },
      "Falha ao avisar o dono da conta sobre o resgate do link de acesso",
    );
  }
}
