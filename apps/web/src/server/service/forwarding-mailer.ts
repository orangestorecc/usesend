import { env } from "~/env";
import { logger } from "~/server/logger/log";
import { sendMail } from "~/server/mailer";

/**
 * O convite de confirmação vai pelo remetente de sistema, nunca pelo domínio
 * do cliente: quem recebe precisa conseguir julgar o pedido pelo que está
 * escrito nele, e não pela reputação de um domínio que não conhece.
 */
function remetenteDeSistema(): string | undefined {
  if (!env.FROM_EMAIL) {
    logger.error(
      "FROM_EMAIL não configurado; confirmação de encaminhamento não enviada",
    );
    return undefined;
  }
  return env.FROM_EMAIL;
}

export async function enviarConfirmacaoDeEncaminhamento(
  destino: string,
  url: string,
) {
  const assunto = "Confirme o encaminhamento de e-mails para esta caixa";
  const texto = [
    "Olá,",
    "",
    `Alguém configurou no Madmail o encaminhamento de e-mails recebidos para ${destino}.`,
    "",
    "Se foi você, confirme pelo link abaixo. Enquanto não houver confirmação, nada é encaminhado:",
    url,
    "",
    "Se não foi você, ignore esta mensagem — sem a confirmação o encaminhamento nunca é ativado.",
    "",
    "Time Madmail",
  ].join("\n");

  if (env.NODE_ENV === "development") {
    logger.info({ destino, url }, "Confirmação de encaminhamento (dev)");
    return;
  }

  const from = remetenteDeSistema();
  if (!from) return;

  await sendMail(destino, assunto, texto, texto.replace(/\n/g, "<br />"), undefined, from);
}
