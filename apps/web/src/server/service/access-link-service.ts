import { createHash, randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "~/server/db";
import { env } from "~/env";
import { logger } from "~/server/logger/log";
import { registrarAuditoria } from "~/server/service/audit-service";
import { consumirCota } from "~/server/service/rate-limit-service";
import { sendAccessLinkEmail } from "~/server/mailer";
import { ACCESS_LINK_VALIDADE_MINUTOS } from "~/lib/access-link";

/**
 * Link de acesso: o produto não tem senha (só OAuth, magic link e MFA), então
 * "dar acesso rápido a um membro" vira um link de uso único e prazo curto.
 *
 * O link NÃO é mais um magic link do NextAuth. Magic link cria sessão global:
 * um admin do time A que entrasse como alguém que também é admin do time B
 * trocava de workspace e virava admin do time B. Agora existe model próprio
 * (`AccessLink`) e rota de resgate própria (`/api/team/access/[token]`), que
 * cria a sessão com `Session.accessLinkTeamId` preenchido — a sessão fica
 * PRESA ao time emissor.
 */

// A validade mora em `~/lib/access-link` (módulo client-safe) porque o diálogo
// de confirmação precisa do número antes de chamar o servidor. Reexportada aqui
// para quem já importa do serviço — o valor é um só.
export { ACCESS_LINK_VALIDADE_MINUTOS };

/**
 * Sessão nascida de link de acesso dura 8 horas. Não são os 30 dias do login
 * normal: isto é acesso assistido, não a sessão da pessoa.
 */
export const ACCESS_LINK_SESSAO_HORAS = 8;

/** Um admin pode gerar 10 links por hora no time. Freia enumeração e spam. */
export const ACCESS_LINK_LIMITE = 10;
export const ACCESS_LINK_JANELA_SEGUNDOS = 60 * 60;

/**
 * Cota por ALVO. Sem ela, cada admin gastava seu próprio balde de 10 na mesma
 * vítima: com cinco admins, 50 e-mails/h para a mesma caixa.
 */
export const ACCESS_LINK_LIMITE_POR_ALVO = 5;

export type LinkDeAcesso = { url: string; expiresAt: Date };

export const ACCESS_LINK_ROTA = "/api/team/access";

type Cliente = PrismaClient | Prisma.TransactionClient;

/**
 * Hash do token guardado no banco. Continua derivando do `NEXTAUTH_SECRET`
 * (segredo que a instalação já é obrigada a ter), mas com prefixo de domínio:
 * um hash desta tabela nunca vale como token de outro mecanismo.
 */
export function hashDoToken(token: string): string {
  const secret = env.NEXTAUTH_SECRET;
  if (!secret) {
    logger.error(
      "NEXTAUTH_SECRET ausente: link de acesso não pode ser gerado nem resgatado",
    );
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Esta instalação está sem a configuração de segurança necessária. Fale com quem administra o Madmail.",
    });
  }
  return createHash("sha256")
    .update(`access-link:${token}:${secret}`)
    .digest("hex");
}

function baseUrl(): string {
  const url = env.NEXTAUTH_URL;
  if (!url) {
    logger.error("NEXTAUTH_URL ausente: link de acesso sairia sem endereço");
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Esta instalação está sem o endereço público configurado. Fale com quem administra o Madmail.",
    });
  }
  return url.replace(/\/$/, "");
}

type Entrada = {
  teamId: number;
  targetUserId: number;
  atorUserId: number;
};

/**
 * Checa aqui, não só na procedure: o serviço é chamável de job e de script, e
 * multi-tenant que confia só na camada de cima vaza acesso entre workspaces.
 */
async function autorizar({ teamId, targetUserId, atorUserId }: Entrada) {
  const ator = await db.teamUser.findUnique({
    where: { teamId_userId: { teamId, userId: atorUserId } },
    select: { role: true, user: { select: { email: true, name: true } } },
  });

  if (!ator || ator.role !== "ADMIN") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Só um admin do workspace pode gerar link de acesso",
    });
  }

  // Entrar na própria conta não é um caso de uso; é só uma forma de sujar a
  // auditoria com um evento de acesso que não aconteceu.
  if (targetUserId === atorUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Você não precisa de um link para entrar na sua própria conta",
    });
  }

  const alvo = await db.teamUser.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
    select: {
      role: true,
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

  if (!alvo) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Esta pessoa não é membro deste workspace",
    });
  }

  // Alvo ADMIN é recusado. O link só existe para destravar quem não consegue
  // entrar; entre admins ele não entrega poder novo dentro do time (o ator já
  // é admin) e entrega, sim, a conta pessoal de um par — inclusive a do dono
  // do time para um admin recém-promovido. Custo zero, vetor a menos.
  if (alvo.role === "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Não é possível gerar link de acesso para outro administrador do workspace",
    });
  }

  if (alvo.user.deletedAt) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Esta conta foi excluída",
    });
  }

  if (!alvo.user.email) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Esta pessoa não tem e-mail cadastrado",
    });
  }

  return {
    atorEmail: ator.user.email,
    // Quem o alvo reconhece é o NOME de quem liberou; o e-mail cru só aparece
    // se a conta não tiver nome. Vem da mesma query, sem custo.
    atorNome: ator.user.name ?? ator.user.email,
    alvo: {
      id: alvo.user.id,
      email: alvo.user.email,
      name: alvo.user.name,
      subjectId: alvo.user.subjectId,
    },
  };
}

async function cobrarCota(teamId: number, atorUserId: number, alvoId: number) {
  const [porAtor, porAlvo] = await Promise.all([
    consumirCota(
      `access-link:${teamId}:${atorUserId}`,
      ACCESS_LINK_LIMITE,
      ACCESS_LINK_JANELA_SEGUNDOS,
    ),
    consumirCota(
      `access-link-alvo:${alvoId}`,
      ACCESS_LINK_LIMITE_POR_ALVO,
      ACCESS_LINK_JANELA_SEGUNDOS,
    ),
  ]);

  if (!porAtor.permitido) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Você gerou links demais na última hora. Tente mais tarde.",
    });
  }

  if (!porAlvo.permitido) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Esta pessoa já recebeu links demais na última hora. Tente mais tarde.",
    });
  }
}

/**
 * Precondição real do ENVIO por e-mail: o `sendMail` precisa de uma API key
 * externa com `FROM_EMAIL`, ou de um domínio verificado na instalação. Sem
 * isso o e-mail estoura lá dentro depois de o token já existir e a cota já
 * ter sido queimada — falhar antes é mais barato e a mensagem é acionável.
 */
async function exigirMailerConfigurado(): Promise<void> {
  if (env.NODE_ENV === "development") return;

  const apiKeyExterna = env.USESEND_API_KEY ?? env.UNSEND_API_KEY;
  if (apiKeyExterna && env.FROM_EMAIL) return;

  const dominio = await db.domain.findFirst({
    where: { status: "SUCCESS" },
    select: { id: true },
  });

  if (dominio) return;

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Nenhum domínio verificado disponível para enviar e-mails. Verifique um domínio ou copie o link e envie por outro canal.",
  });
}

/**
 * Gera o link e devolve a URL absoluta. O token cru só existe no retorno: no
 * banco fica apenas o hash, então nem um dump do banco reabre a sessão.
 */
export async function gerarLinkDeAcesso(
  entrada: Entrada,
  evento: "access_link_created" | "access_link_sent" = "access_link_created",
): Promise<LinkDeAcesso> {
  return emitir(entrada, await autorizar(entrada), evento);
}

type Autorizacao = Awaited<ReturnType<typeof autorizar>>;

async function emitir(
  entrada: Entrada,
  { atorEmail, alvo }: Autorizacao,
  evento: "access_link_created" | "access_link_sent",
): Promise<LinkDeAcesso> {
  // Estoura antes de gastar cota se a instalação não puder sequer montar a URL.
  const base = baseUrl();
  await cobrarCota(entrada.teamId, entrada.atorUserId, alvo.id);

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + ACCESS_LINK_VALIDADE_MINUTOS * 60 * 1000,
  );

  await db.$transaction(async (tx) => {
    await tx.accessLink.create({
      data: {
        tokenHash: hashDoToken(token),
        teamId: entrada.teamId,
        targetUserId: alvo.id,
        createdByUserId: entrada.atorUserId,
        expiresAt,
      },
    });

    await registrarAuditoria(
      evento,
      {
        actorUserId: entrada.atorUserId,
        actorEmail: atorEmail,
        targetUserId: alvo.id,
        targetSubject: alvo.subjectId,
        targetEmail: alvo.email,
        metadata: {
          teamId: entrada.teamId,
          expiresAt: expiresAt.toISOString(),
        },
      },
      tx,
    );
  });

  return { url: `${base}${ACCESS_LINK_ROTA}/${token}`, expiresAt };
}

/**
 * Mesma geração, só que a URL nunca volta para quem pediu: vai direto para o
 * dono da conta. Admin que pede "enviar por e-mail" não precisa ver o segredo.
 */
export async function enviarLinkDeAcesso(
  entrada: Entrada & { teamName: string },
): Promise<{ expiresAt: Date }> {
  // Falha antes de criar token e queimar cota se o envio não tem como sair.
  await exigirMailerConfigurado();

  const autorizacao = await autorizar(entrada);

  // O e-mail não sai sem dizer QUEM liberou. Texto genérico ("um administrador
  // do workspace") é indistinguível de phishing, então falta de identificação é
  // recusa, não fallback. Cai aqui antes de queimar cota e criar token.
  if (!autorizacao.atorNome) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Preencha seu nome no perfil antes de enviar um link de acesso: quem recebe precisa saber quem liberou.",
    });
  }

  const { url, expiresAt } = await emitir(
    entrada,
    autorizacao,
    "access_link_sent",
  );
  const { atorNome, alvo } = autorizacao;

  // Sem segunda query: `autorizar()` já carregou o alvo e já garantiu o e-mail.
  await sendAccessLinkEmail(alvo.email, url, {
    minutosDeValidade: ACCESS_LINK_VALIDADE_MINUTOS,
    nome: alvo.name,
    quemLiberou: atorNome,
    nomeDoWorkspace: entrada.teamName,
  });

  return { expiresAt };
}

/**
 * Consome o link: uso único garantido por update condicional (`usedAt: null` +
 * `expiresAt > agora`). Read-then-write perderia a corrida de dois cliques
 * simultâneos e abriria duas sessões com o mesmo token.
 */
export async function consumirLinkDeAcesso(
  token: string,
  cliente: Cliente = db,
): Promise<{
  id: string;
  teamId: number;
  targetUserId: number;
  createdByUserId: number;
} | null> {
  const agora = new Date();
  const tokenHash = hashDoToken(token);

  const { count } = await cliente.accessLink.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: agora } },
    data: { usedAt: agora },
  });

  if (count === 0) return null;

  const link = await cliente.accessLink.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      teamId: true,
      targetUserId: true,
      createdByUserId: true,
    },
  });

  return link;
}

/**
 * Membro removido do time perde os links pendentes na hora — senão um convite
 * de 30 minutos sobrevive à demissão. Derruba junto as sessões que já estavam
 * presas àquele time por link de acesso.
 */
export async function invalidarLinksDoMembro(
  teamId: number,
  userId: number,
  cliente: Cliente = db,
): Promise<void> {
  await cliente.accessLink.deleteMany({
    where: { teamId, targetUserId: userId, usedAt: null },
  });

  await cliente.session.deleteMany({
    where: { userId, accessLinkTeamId: teamId },
  });
}
