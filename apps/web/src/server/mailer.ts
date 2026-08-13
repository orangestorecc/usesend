import { env } from "~/env";
import { UseSend } from "usesend-js";
import { isSelfHosted } from "~/utils/common";
import { db } from "./db";
import { getDomains } from "./service/domain-service";
import { sendEmail } from "./service/email-service";
import { logger } from "./logger/log";
import { renderOtpEmail, renderTeamInviteEmail } from "./email-templates";

let usesend: UseSend | undefined;

const getClient = () => {
  if (!usesend) {
    usesend = new UseSend(env.USESEND_API_KEY ?? env.UNSEND_API_KEY);
  }
  return usesend;
};

export async function sendSignUpEmail(
  email: string,
  token: string,
  url: string
) {
  const { host } = new URL(url);

  if (env.NODE_ENV === "development") {
    logger.info({ email, url, token }, "Sending sign in email");
    return;
  }

  const subject = "Entre na sua conta Madmail";

  // Use jsx-email template for beautiful HTML
  const html = await renderOtpEmail({
    otpCode: token.toUpperCase(),
    loginUrl: url,
    hostName: host,
  });

  // Fallback text version
  const text = `Olá,\n\nVocê pode entrar na sua conta Madmail clicando no link abaixo:\n${url}\n\nOu use este código (OTP): ${token}\n\nAtenciosamente,\nTime Madmail`;

  await sendMail(email, subject, text, html);
}

export async function sendTeamInviteEmail(
  email: string,
  url: string,
  teamName: string
) {
  const { host } = new URL(url);

  if (env.NODE_ENV === "development") {
    logger.info({ email, url, teamName }, "Sending team invite email");
    return;
  }

  const subject = "Você foi convidado para entrar no Madmail";

  // Use jsx-email template for beautiful HTML
  const html = await renderTeamInviteEmail({
    teamName,
    inviteUrl: url,
  });

  // Fallback text version
  const text = `Olá,\n\nVocê foi convidado para entrar no time ${teamName} no Madmail.\n\nPara aceitar o convite, clique no link abaixo:\n${url}\n\nAtenciosamente,\nTime Madmail`;

  await sendMail(email, subject, text, html);
}

export async function sendSubscriptionConfirmationEmail(email: string) {
  if (!env.FOUNDER_EMAIL) {
    logger.error("FOUNDER_EMAIL not configured");
    return;
  }

  const subject = "Obrigado por assinar o Madmail";
  const text = `Olá,\n\nObrigado por assinar o Madmail! Só passando para avisar que você pode entrar no nosso servidor do Discord para ter um canal de suporte dedicado ao seu time, assim conseguimos responder suas dúvidas / bugs o mais rápido possível.\n\nVocê pode entrar por este link: https://discord.com/invite/BU8n8pJv8S\n\nSe preferir o Slack, é só me avisar.\n\nAbraços,\nkoushik - Madmail`;
  const html = text.replace(/\n/g, "<br />");

  await sendMail(email, subject, text, html, undefined, env.FOUNDER_EMAIL);
}

export async function sendMail(
  email: string,
  subject: string,
  text: string,
  html: string,
  replyTo?: string,
  fromOverride?: string
) {
  // Quando há uma API key externa configurada (deploy que envia via nuvem
  // pública do Madmail), usa o SDK. Caso contrário, envia internamente via SES
  // usando o domínio verificado do time — funciona tanto em self-hosted quanto
  // em cloud/multi-tenant sem depender de serviço externo.
  const externalApiKey = env.USESEND_API_KEY ?? env.UNSEND_API_KEY;

  if (externalApiKey && (env.FROM_EMAIL || fromOverride)) {
    const fromAddress = fromOverride ?? env.FROM_EMAIL!;
    const resp = await getClient().emails.send({
      to: email,
      from: fromAddress,
      subject,
      text,
      html,
      replyTo,
    });

    if (resp.data) {
      logger.info("Email sent using usesend");
      return;
    }

    logger.error(
      { code: resp.error?.code, message: resp.error?.message },
      "Error sending email using usesend"
    );
    return;
  }

  logger.info("Sending email using internal SES");
  /*
    Envio interno: usa o primeiro time e um de seus domínios verificados como
    remetente dos e-mails de sistema (OTP, convites, etc).
    Assume que a instância tem ao menos um time com domínio verificado.
    TODO: fix this
   */
  const team = await db.team.findFirst({});
  if (!team) {
    logger.error("No team found");
    return;
  }

  const domains = await getDomains(team.id);

  if (domains.length === 0 || !domains[0]) {
    logger.error("No domains found");
    return;
  }

  const availableDomains = domains.map((d) => d.name);
  const domain = domains[0];

  const candidateFroms = [fromOverride, env.FROM_EMAIL, `hello@${domain.name}`].filter(
    (value): value is string => Boolean(value)
  );

  const selectedFrom =
    candidateFroms.find((address) => {
      const domainPart = address.split("@")[1];
      return domainPart ? availableDomains.includes(domainPart) : false;
    }) ?? `hello@${domain.name}`;

  await sendEmail({
    teamId: team.id,
    to: email,
    from: selectedFrom,
    subject,
    text,
    html,
    replyTo,
    // OTP de login, MFA, convites, avisos de limite e de bloqueio: nunca podem
    // ser barrados pelo controle de bounce, senao um cliente bloqueado ficaria
    // sem conseguir entrar no painel para resolver o problema.
    isSystemEmail: true,
  });
}
