import { env } from "~/env";
import { db } from "~/server/db";

/**
 * Admin da plataforma é quem administra a instalação inteira (/admin): todos os
 * times, faturamento, SES, auditoria. Não confundir com `TeamUser.role=ADMIN`,
 * que é admin de um workspace só.
 *
 * A regra tem duas partes e as duas importam:
 * - `User.isAdmin`, que o próprio admin gerencia pela tela, sem deploy;
 * - o dono do `ADMIN_EMAIL`, que é admin mesmo com a coluna false. Essa
 *   salvaguarda existe para a instalação nunca ficar sem nenhum admin — por
 *   engano na tela, por restauração de backup antiga, ou logo depois da
 *   migração, quando ninguém tem a coluna marcada ainda.
 */
export function ehAdminDaPlataforma(usuario: {
  email?: string | null;
  isAdmin?: boolean | null;
}): boolean {
  if (usuario.isAdmin) {
    return true;
  }

  const adminEmail = env.ADMIN_EMAIL;
  if (!adminEmail || !usuario.email) {
    return false;
  }

  return usuario.email.toLowerCase() === adminEmail.toLowerCase();
}

/** Igual a `ehAdminDaPlataforma`, mas lendo o estado atual do banco. */
export async function ehAdminDaPlataformaPorId(userId: number) {
  const usuario = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, isAdmin: true, deletedAt: true },
  });

  if (!usuario || usuario.deletedAt) {
    return false;
  }

  return ehAdminDaPlataforma(usuario);
}

/**
 * Um admin não pode remover a si mesmo nem esvaziar a lista: sem isto, dois
 * cliques deixariam o painel sem dono e só um acesso ao banco resolveria.
 */
export async function podeRemoverAdmin(
  alvoId: number,
  solicitanteId: number,
): Promise<{ pode: boolean; motivo?: string }> {
  if (alvoId === solicitanteId) {
    return { pode: false, motivo: "Você não pode remover o seu próprio acesso de admin." };
  }

  const restantes = await db.user.count({
    where: { isAdmin: true, deletedAt: null, id: { not: alvoId } },
  });

  const temSalvaguarda = Boolean(env.ADMIN_EMAIL);

  if (restantes === 0 && !temSalvaguarda) {
    return {
      pode: false,
      motivo: "Este é o último admin da plataforma.",
    };
  }

  return { pode: true };
}
