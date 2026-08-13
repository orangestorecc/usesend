import { db } from "~/server/db";
import { logger } from "~/server/logger/log";
import { sendMail } from "~/server/mailer";

/**
 * Aviso de cobrança gerada (PIX / boleto).
 *
 * O cliente sai do checkout com o QR na tela, mas fecha a aba e perde os
 * dados. O e-mail é a cópia que fica: traz o copia-e-cola ou a linha
 * digitável e diz onde reencontrar a fatura.
 *
 * Nunca lança: falha no envio não pode desfazer uma cobrança que já existe no
 * banco — o cliente ainda tem os dados na tela.
 */

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export async function enviarAvisoDeCobranca(chargeId: string): Promise<void> {
  try {
    const charge = await db.charge.findUnique({ where: { id: chargeId } });
    if (!charge) return;

    const contact = await db.billingContact.findUnique({
      where: { teamId: charge.teamId },
    });
    // O responsável financeiro é quem recebe cobrança; sem ele, o dono do time.
    const destino =
      contact?.email ??
      (
        await db.teamUser.findFirst({
          where: { teamId: charge.teamId, role: "ADMIN" },
          include: { user: true },
        })
      )?.user?.email;

    if (!destino) {
      logger.warn(
        { chargeId, teamId: charge.teamId },
        "[ChargeMailer]: cobrança sem destinatário para o aviso",
      );
      return;
    }

    const valor = brl(charge.amountCents);
    const ehPix = charge.method === "pix";
    const subject = ehPix
      ? `Madmail: seu PIX de ${valor} está aguardando pagamento`
      : `Madmail: seu boleto de ${valor} foi gerado`;

    const linhas: string[] = [
      "Olá,",
      "",
      `Recebemos seu pedido de assinatura e geramos uma cobrança de ${valor}.`,
      "",
    ];

    if (ehPix && charge.pixQrCode) {
      linhas.push(
        "PIX copia e cola:",
        charge.pixQrCode,
        "",
        "Abra o app do seu banco, escolha PIX > Copia e cola e cole o código acima.",
      );
    }
    if (!ehPix && charge.boletoBarcode) {
      linhas.push("Linha digitável do boleto:", charge.boletoBarcode, "");
    }

    linhas.push(
      "",
      "Assim que o pagamento for confirmado, seu plano é ativado automaticamente — você não precisa fazer mais nada.",
      "",
      "A fatura fica disponível em Configurações > Faturamento.",
      "",
      "Time Madmail",
    );

    const text = linhas.join("\n");
    const html = linhas
      .map((linha) =>
        // Copia-e-cola e linha digitável são longos e não podem quebrar em
        // pedaços que o cliente copiaria errado.
        linha === charge.pixQrCode || linha === charge.boletoBarcode
          ? `<pre style="white-space:pre-wrap;word-break:break-all;background:#f4f4f5;padding:12px;border-radius:6px;font-family:monospace;font-size:12px">${linha}</pre>`
          : `<p style="margin:0 0 8px">${linha || "&nbsp;"}</p>`,
      )
      .join("");

    await sendMail(destino, subject, text, html);
  } catch (err) {
    logger.error(
      { err, chargeId },
      "[ChargeMailer]: falha ao enviar o aviso de cobrança",
    );
  }
}
