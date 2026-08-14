import { env } from "~/env";
import { logger } from "../logger/log";
import { sendMail } from "../mailer";
import { escapeHtml, toPlainHtml } from "../utils/email-content";
import { sendToDiscord } from "./notification-service";

/**
 * Add-on de IP dedicado: avisos internos.
 *
 * O pedido do cliente gravava só um timestamp no banco e não avisava ninguém —
 * o cliente via "o aquecimento leva alguns dias" e do outro lado não havia
 * lado nenhum. Aqui o pedido vira Discord + e-mail para quem provisiona.
 *
 * Nada disto pode derrubar a mutation que o cliente chamou: se o webhook cair,
 * o pedido continua registrado e o /admin/ip-dedicado continua mostrando a
 * fila. O aviso é conveniência, a fila é a fonte de verdade.
 */

export type EventoIpDedicado = "solicitado" | "cancelado";

type TimeDoAviso = {
  id: number;
  name: string;
  planKey: string;
  /** E-mail de quem clicou, para o time responder direto. */
  solicitante?: string | null;
};

const ASSUNTO: Record<EventoIpDedicado, string> = {
  solicitado: "Novo pedido de IP dedicado",
  cancelado: "Pedido de IP dedicado cancelado",
};

export async function notificarPedidoIpDedicado(
  evento: EventoIpDedicado,
  time: TimeDoAviso,
): Promise<void> {
  const acao =
    evento === "solicitado"
      ? "pediu um IP dedicado"
      : "cancelou o pedido de IP dedicado";
  const resumo =
    `**${time.name}** (time #${time.id}, plano \`${time.planKey}\`) ${acao}.` +
    (time.solicitante ? `\nSolicitante: ${time.solicitante}` : "");

  await Promise.allSettled([
    avisarDiscord(evento, resumo),
    avisarPorEmail(evento, time, acao),
  ]);
}

async function avisarDiscord(evento: EventoIpDedicado, resumo: string) {
  const prefixo = evento === "solicitado" ? "🟠 IP dedicado" : "⚪ IP dedicado";
  try {
    await sendToDiscord(
      `${prefixo}\n${resumo}\nFila: /admin/ip-dedicado`,
    );
  } catch (error) {
    // Aviso é conveniência; o pedido já está no banco e na fila do admin.
    logger.warn({ err: error, evento }, "Falha ao avisar Discord do IP dedicado");
  }
}

async function avisarPorEmail(
  evento: EventoIpDedicado,
  time: TimeDoAviso,
  acao: string,
) {
  const destino = env.FOUNDER_EMAIL ?? env.ADMIN_EMAIL;
  if (!destino) {
    logger.warn(
      { teamId: time.id, evento },
      "Sem FOUNDER_EMAIL/ADMIN_EMAIL: pedido de IP dedicado só ficou na fila do admin",
    );
    return;
  }

  const texto =
    `${time.name} (time #${time.id}, plano ${time.planKey}) ${acao}.\n` +
    (time.solicitante ? `Solicitante: ${time.solicitante}\n` : "") +
    `\nAtenda em ${env.NEXTAUTH_URL ?? ""}/admin/ip-dedicado`;

  try {
    await sendMail(
      destino,
      `${ASSUNTO[evento]} · ${time.name}`,
      texto,
      toPlainHtml(escapeHtml(texto)),
      time.solicitante ?? undefined,
    );
  } catch (error) {
    logger.warn({ err: error, evento }, "Falha ao enviar e-mail do IP dedicado");
  }
}
