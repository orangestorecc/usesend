import { env } from "~/env";
import { UseSend } from "usesend-js";
import { isSelfHosted } from "~/utils/common";
import { db } from "./db";
import { sendEmail } from "./service/email-service";
import { logger } from "./logger/log";
import {
  renderAccessLinkEmail,
  renderAccessLinkRedeemedEmail,
  renderOtpEmail,
  renderTeamInviteEmail,
} from "./email-templates";

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

  // Nomear o workspace no assunto: a pessoa pode ter convite de vários.
  const subject = `Convite para o workspace ${teamName} no Madmail`;

  // Use jsx-email template for beautiful HTML
  const html = await renderTeamInviteEmail({
    teamName,
    inviteUrl: url,
  });

  // Fallback text version
  const text = `Olá,\n\nVocê foi convidado para o workspace ${teamName} no Madmail.\n\nPara aceitar o convite, clique no link abaixo:\n${url}\n\nAtenciosamente,\nEquipe Madmail`;

  await sendMail(email, subject, text, html);
}

/**
 * Link de acesso de uso único gerado por um admin do time. Sai pelo mesmo
 * caminho de remetente de sistema (`sendMail` → `resolveSystemSender`).
 */
export async function sendAccessLinkEmail(
  email: string,
  url: string,
  options: {
    minutosDeValidade: number;
    nome?: string | null;
    /**
     * Nome (ou e-mail) de quem liberou o acesso. OBRIGATÓRIO: um e-mail que
     * pede para clicar num link e não diz quem mandou é, do ponto de vista de
     * quem recebe, phishing. Sem fallback genérico — quem não consegue
     * preencher isto não envia.
     */
    quemLiberou: string;
    /** Workspace de onde o acesso saiu. Obrigatório pelo mesmo motivo. */
    nomeDoWorkspace: string;
  }
) {
  if (env.NODE_ENV === "development") {
    logger.info({ email, url }, "Sending access link email");
    return;
  }

  const { quemLiberou, nomeDoWorkspace } = options;

  // O assunto precisa nomear o workspace: é o que separa um acesso legítimo de
  // um phishing na lista de e-mails de quem administra várias contas.
  const subject = `${nomeDoWorkspace}: seu link de acesso ao Madmail`;

  const html = await renderAccessLinkEmail({
    accessUrl: url,
    minutosDeValidade: options.minutosDeValidade,
    nome: options.nome,
    quemLiberou,
    nomeDoWorkspace,
  });

  const text = `Olá,\n\n${quemLiberou} liberou um acesso rápido para você no workspace ${nomeDoWorkspace}, no Madmail. Entre por este link:\n${url}\n\nO link vale por ${options.minutosDeValidade} minutos e funciona uma única vez. Não repasse para ninguém: quem abrir entra na sua conta.\n\nSe você não pediu este acesso, não clique e avise nosso suporte em suporte@madmail.com.br.\n\nMadmail`;

  await sendMail(email, subject, text, html);
}

/**
 * Aviso para o dono da conta de que um link de acesso foi RESGATADO. Existe
 * porque na variante "copiar link" o link nunca passa pela caixa de entrada
 * dela: sem este e-mail, quem tem a conta acessada nunca fica sabendo. Sai
 * pelo mesmo caminho de remetente de sistema (`sendMail` → `resolveSystemSender`).
 */
export async function sendAccessLinkRedeemedEmail(
  email: string,
  options: {
    /** Nome (ou e-mail) de quem liberou o acesso. */
    quemLiberou: string;
    /** Workspace onde a sessão nasceu presa. */
    nomeDoWorkspace: string;
    /** Momento do resgate. */
    quando: Date;
    /** Duração da sessão — vem de `ACCESS_LINK_SESSAO_HORAS`, sem repetir o 8. */
    horasDeSessao: number;
    nome?: string | null;
  }
) {
  if (env.NODE_ENV === "development") {
    logger.info({ email, ...options }, "Sending access link redeemed email");
    return;
  }

  const { quemLiberou, nomeDoWorkspace, horasDeSessao } = options;

  const quando = options.quando.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const subject = `${nomeDoWorkspace}: alguém entrou na sua conta com um link de acesso`;

  const html = await renderAccessLinkRedeemedEmail({
    quemLiberou,
    nomeDoWorkspace,
    quando,
    horasDeSessao,
    nome: options.nome,
  });

  const text = `Olá,\n\nUm link de acesso à sua conta Madmail foi usado em ${quando}. O acesso foi liberado por ${quemLiberou} e vale apenas dentro do workspace ${nomeDoWorkspace}.\n\nA sessão criada por esse link dura ${horasDeSessao} horas e expira sozinha. Tudo o que for feito nela fica registrado na auditoria do workspace, com a identificação de quem liberou o acesso.\n\nSe você combinou esse acesso, não precisa fazer nada. Se não reconhece ${quemLiberou} nem o workspace ${nomeDoWorkspace}, avise nosso suporte em suporte@madmail.com.br.\n\nMadmail`;

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

/**
 * Descobre de qual time/domínio verificado sai um e-mail de sistema.
 * Ordem: domínio do fromOverride → domínio do FROM_EMAIL → qualquer domínio
 * verificado da instância (self-hosted sem FROM_EMAIL configurado).
 */
async function resolveSystemSender(
  fromOverride?: string
): Promise<{ teamId: number; from: string } | null> {
  const candidates = [fromOverride, env.FROM_EMAIL].filter(
    (value): value is string => Boolean(value)
  );

  for (const address of candidates) {
    const domainName = address.split("@")[1];
    if (!domainName) continue;

    const domain = await db.domain.findFirst({
      where: { name: domainName, status: "SUCCESS" },
    });

    if (domain) {
      return { teamId: domain.teamId, from: address };
    }
  }

  const fallback = await db.domain.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { createdAt: "asc" },
  });

  if (!fallback) {
    return null;
  }

  return { teamId: fallback.teamId, from: `hello@${fallback.name}` };
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
      {
        code: resp.error?.code,
        message: resp.error?.message,
        to: email,
        subject,
      },
      "Error sending email using usesend"
    );
    throw new Error(
      resp.error?.message ?? "Falha ao enviar e-mail pela API do Madmail"
    );
  }

  logger.info("Sending email using internal SES");
  /*
    Envio interno: o remetente de sistema (OTP, convites, avisos) sai sempre do
    domínio verificado dono do FROM_EMAIL — e o e-mail é registrado no time que
    possui esse domínio. Antes usávamos o "primeiro time" da base, o que fazia
    o envio morrer em silêncio quando esse time não tinha domínio verificado.
   */
  const sender = await resolveSystemSender(fromOverride);

  if (!sender) {
    logger.error(
      { to: email, subject, fromOverride, fromEnv: env.FROM_EMAIL },
      "Nenhum domínio verificado disponível para enviar e-mail de sistema"
    );
    throw new Error(
      "Nenhum domínio verificado disponível para enviar e-mails do sistema"
    );
  }

  const { teamId, from: selectedFrom } = sender;

  await sendEmail({
    teamId,
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
