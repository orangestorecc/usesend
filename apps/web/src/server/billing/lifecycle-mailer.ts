import { db } from "~/server/db";
import { env } from "~/env";
import { logger } from "~/server/logger/log";
import { sendMail } from "~/server/mailer";

/**
 * Avisos do ciclo de vida: envio travado por atraso e conta gratuita prestes a
 * ser excluída.
 *
 * Nunca lançam. Um e-mail que não sai não pode impedir a trava (o cliente
 * continua vendo o aviso no painel) nem travar a varredura noturna.
 */

function urlDoPainel(caminho: string) {
  const base = env.NEXTAUTH_URL ?? "https://app.madmail.com.br";
  return `${base.replace(/\/$/, "")}${caminho}`;
}

/** Responsável financeiro; sem ele, o admin do time. */
async function destinatario(teamId: number): Promise<string | null> {
  const contato = await db.billingContact.findUnique({ where: { teamId } });
  if (contato?.email) return contato.email;
  const admin = await db.teamUser.findFirst({
    where: { teamId, role: "ADMIN" },
    include: { user: true },
  });
  return admin?.user?.email ?? null;
}

async function enviar(
  teamId: number,
  subject: string,
  linhas: string[],
  contexto: string,
) {
  try {
    const destino = await destinatario(teamId);
    if (!destino) {
      logger.warn({ teamId, contexto }, "[LifecycleMailer]: time sem destinatário");
      return;
    }
    const text = linhas.join("\n");
    const html = linhas
      .map((l) => `<p style="margin:0 0 8px">${l || "&nbsp;"}</p>`)
      .join("");
    await sendMail(destino, subject, text, html);
  } catch (err) {
    logger.error({ err, teamId, contexto }, "[LifecycleMailer]: falha no envio");
  }
}

/** Envio pausado por fatura em atraso. */
export async function enviarAvisoDeTrava(teamId: number) {
  await enviar(
    teamId,
    "Madmail: seus envios foram pausados por uma fatura em aberto",
    [
      "Olá,",
      "",
      "Sua fatura venceu há mais de 24 horas e, por isso, os envios da sua conta foram pausados.",
      "",
      "Nada foi perdido: assim que o pagamento for confirmado, os envios voltam automaticamente, sem precisar refazer nenhuma configuração.",
      "",
      `Pague a fatura em ${urlDoPainel("/settings/billing")}.`,
      "",
      "Se o pagamento já foi feito nas últimas horas, pode ignorar este e-mail — a confirmação pode levar alguns minutos.",
      "",
      "Time Madmail",
    ],
    "trava",
  );
}

/** Conta gratuita parada: aviso 30 dias antes da exclusão. */
export async function enviarAvisoDeInatividade(teamId: number, excluirEm: Date) {
  const data = excluirEm.toLocaleDateString("pt-BR");
  await enviar(
    teamId,
    "Madmail: sua conta será excluída em 30 dias",
    [
      "Olá,",
      "",
      "Sua conta gratuita está sem uso há 6 meses. Contas paradas por esse tempo são excluídas para não guardarmos dados de quem não precisa mais deles.",
      "",
      `Se nada mudar, a exclusão acontece em ${data} e apaga contatos, domínios e histórico de envios.`,
      "",
      `Para manter a conta, basta entrar no painel ou enviar um e-mail: ${urlDoPainel("/dashboard")}.`,
      "",
      "Qualquer atividade cancela a exclusão automaticamente.",
      "",
      "Time Madmail",
    ],
    "inatividade",
  );
}
