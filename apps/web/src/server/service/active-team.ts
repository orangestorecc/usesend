import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "~/server/db";
import { lerSessionTokenDoCookie } from "~/server/auth-session";

/**
 * Cookie que guarda o workspace escolhido explicitamente pelo usuário.
 * É dado do cliente: o valor SEMPRE é revalidado contra o banco antes de virar
 * contexto de time — quem editar o cookie na mão não entra em time alheio.
 */
export const WORKSPACE_COOKIE = "madmail-workspace";

/** 30 dias, mesma ordem de grandeza da sessão: a escolha sobrevive a fechar o navegador. */
export const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function lerWorkspaceDoCookie(headers: Headers): number | null {
  const cru = headers.get("cookie");
  if (!cru) return null;

  for (const parte of cru.split(";")) {
    const [nome, ...resto] = parte.trim().split("=");
    if (nome !== WORKSPACE_COOKIE) continue;

    const valor = Number(decodeURIComponent(resto.join("=")));
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  }
  return null;
}

type Cliente = PrismaClient | Prisma.TransactionClient;

/**
 * Sinal exposto para a UI (banner de "acesso assistido") e trava do backend:
 * o `teamId` a que a sessão atual está presa por ter nascido de um link de
 * acesso, ou `null` numa sessão normal. Nome do sinal: `acessoPresoAoTime`.
 *
 * Vem da row de `Session`, não de cookie: cookie o cliente reescreve.
 */
export async function lerTravaDeLinkDeAcesso(
  headers: Headers,
  cliente: Cliente = db,
): Promise<number | null> {
  const token = lerSessionTokenDoCookie(headers);
  if (!token) return null;

  const sessao = await cliente.session.findUnique({
    where: { sessionToken: token },
    select: { accessLinkTeamId: true },
  });

  return sessao?.accessLinkTeamId ?? null;
}

/**
 * O vínculo (`TeamUser` + `team`) do workspace ativo do usuário.
 *
 * Ordem de resolução:
 * 1. cookie `madmail-workspace`, desde que exista `TeamUser` do usuário nele;
 * 2. fallback determinístico pelo menor `teamId` — nunca um `findFirst` solto,
 *    senão o "time atual" muda conforme o humor do plano de query.
 *
 * Devolve `null` quando o usuário não pertence a nenhum time.
 */
export async function resolverTimeAtivo(
  userId: number,
  headers: Headers,
  cliente: Cliente = db,
  /**
   * Trava já lida por quem chamou (o `protectedProcedure` lê uma vez por
   * request). `undefined` significa "ainda não li" — aí lemos aqui.
   */
  travaConhecida?: number | null,
) {
  // Sessão nascida de link de acesso é presa ao time emissor. Aqui o cookie
  // não vale nada: é exatamente por ele que se escapava para outro workspace.
  const presaAoTime =
    travaConhecida === undefined
      ? await lerTravaDeLinkDeAcesso(headers, cliente)
      : travaConhecida;
  if (presaAoTime !== null) {
    return cliente.teamUser.findFirst({
      where: { userId, teamId: presaAoTime },
      include: { team: true },
    });
  }

  const teamIdDoCookie = lerWorkspaceDoCookie(headers);

  if (teamIdDoCookie !== null) {
    const escolhido = await cliente.teamUser.findFirst({
      where: { userId, teamId: teamIdDoCookie },
      include: { team: true },
    });
    if (escolhido) return escolhido;
  }

  return cliente.teamUser.findFirst({
    where: { userId },
    include: { team: true },
    orderBy: { teamId: "asc" },
  });
}

/**
 * Porta única de "com qual time este request pode operar" para route handlers
 * e server actions — o equivalente ao que o `protectedProcedure` faz no tRPC.
 *
 * Existe porque `db.teamUser.findFirst({ where: { userId } })` solto era o
 * padrão espalhado pelas rotas: sem ordem (o "time atual" mudava com o plano
 * de query) e, pior, sem a trava de link de acesso — uma sessão presa ao time
 * A saía operando no time B por qualquer porta que não fosse tRPC.
 *
 * - `teamIdPretendido === null`: devolve o time ativo do request (cookie
 *   revalidado, ou a trava, ou o fallback determinístico).
 * - `teamIdPretendido` informado: só devolve o vínculo se o usuário pertencer
 *   àquele time E a sessão não estiver presa a outro.
 *
 * Devolve `null` quando não há vínculo permitido — quem chama traduz para o
 * 403/404 da sua camada.
 */
export async function exigirTimePermitido(
  userId: number,
  teamIdPretendido: number | null,
  headers: Headers,
  cliente: Cliente = db,
) {
  const presaAoTime = await lerTravaDeLinkDeAcesso(headers, cliente);

  if (teamIdPretendido === null) {
    return resolverTimeAtivo(userId, headers, cliente, presaAoTime);
  }

  if (presaAoTime !== null && presaAoTime !== teamIdPretendido) return null;

  return cliente.teamUser.findFirst({
    where: { userId, teamId: teamIdPretendido },
    include: { team: true },
  });
}

/**
 * Valida que o usuário pertence ao time. Usado pela rota de troca de workspace
 * antes de gravar o cookie.
 */
export async function usuarioPertenceAoTime(
  userId: number,
  teamId: number,
  cliente: Cliente = db,
): Promise<boolean> {
  const vinculo = await cliente.teamUser.findFirst({
    where: { userId, teamId },
    select: { teamId: true },
  });
  return Boolean(vinculo);
}
