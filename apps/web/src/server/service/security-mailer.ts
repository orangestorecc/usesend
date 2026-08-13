import { env } from "~/env";
import { logger } from "~/server/logger/log";
import { sendMail } from "~/server/mailer";

/**
 * E-mails de segurança (códigos, troca de e-mail, MFA, exclusão) precisam de
 * remetente de sistema explícito. O fallback "primeiro time do banco" do
 * `sendMail` é aceitável para convite, mas não aqui: mandar prova de
 * identidade pelo domínio de um cliente qualquer é o tipo de coisa que só se
 * descobre depois de acontecer.
 */
function remetenteDeSistema(): string {
  if (!env.FROM_EMAIL) {
    throw new Error(
      "FROM_EMAIL não configurado; e-mails de segurança não podem ser enviados",
    );
  }
  return env.FROM_EMAIL;
}

async function enviar(
  para: string,
  assunto: string,
  texto: string,
): Promise<void> {
  if (env.NODE_ENV === "development") {
    logger.info({ para, assunto, texto }, "E-mail de segurança (dev)");
    return;
  }
  const html = texto.replace(/\n/g, "<br />");
  await sendMail(para, assunto, texto, html, undefined, remetenteDeSistema());
}

/**
 * Assunto começa pelo código (padrão Google/Slack): o código fica visível na
 * lista da caixa de entrada, sem precisar abrir.
 */
export async function enviarCodigoDeSeguranca(
  para: string,
  codigo: string,
  motivo: string,
): Promise<void> {
  await enviar(
    para,
    `${codigo.toUpperCase()} é o seu código da Madmail`,
    `Olá,\n\nSeu código é ${codigo.toUpperCase()}.\n\nEle serve para ${motivo} e vale por 10 minutos.\n\nSe não foi você quem pediu, ignore esta mensagem — nada muda na sua conta sem o código.\n\nMadmail`,
  );
}

export async function enviarAvisoDeTrocaDeEmail(
  emailAntigo: string,
  emailNovo: string,
  urlReversao: string,
  prazo: Date,
): Promise<void> {
  const quando = prazo.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await enviar(
    emailAntigo,
    "O e-mail da sua conta Madmail foi alterado",
    `Olá,\n\nO e-mail de acesso da sua conta Madmail passou de ${emailAntigo} para ${emailNovo}.\n\nSe foi você, não precisa fazer nada.\n\nSe NÃO foi você, reverta agora:\n${urlReversao}\n\nEste link vale até ${quando}. Depois desse prazo, a reversão precisa passar pelo suporte.\n\nMadmail`,
  );
}

export async function enviarAvisoDeMfa(
  para: string,
  ativado: boolean,
): Promise<void> {
  await enviar(
    para,
    ativado
      ? "Confirmação por e-mail ativada na sua conta"
      : "Confirmação por e-mail desativada na sua conta",
    ativado
      ? `Olá,\n\nA confirmação por e-mail em logins com Google e GitHub foi ativada na sua conta Madmail. A partir de agora, entrar por essas contas pede um código enviado para este endereço.\n\nSe não foi você, entre em contato com o suporte.\n\nMadmail`
      : `Olá,\n\nA confirmação por e-mail em logins com Google e GitHub foi desativada na sua conta Madmail.\n\nSe não foi você, entre em contato com o suporte imediatamente.\n\nMadmail`,
  );
}
