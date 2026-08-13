import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { env } from "~/env";
import { db } from "../db";
import { logger } from "../logger/log";
import { getAwsCredentialOptions } from "~/server/aws/credentials";
import { enfileirarEncaminhamentos } from "./forwarding-service";
import { extrairDestinatariosDeEnvelope } from "../utils/inbound-recipients";
import { WebhookService } from "./webhook-service";
import type { EmailReceivedPayload } from "@usesend/lib/src/webhook/webhook-events";

let s3: S3Client | undefined;
function getS3() {
  if (!s3) {
    s3 = new S3Client({
      region: env.INBOUND_S3_REGION,
      ...getAwsCredentialOptions(),
    });
  }
  return s3;
}

const PREFIX_NEW = "inbound/";
const PREFIX_DONE = "processed/";

/** Baixa o MIME bruto de um objeto do bucket de recebimento. */
export async function baixarMimeBruto(key: string): Promise<Buffer | null> {
  const bucket = env.INBOUND_S3_BUCKET;
  if (!bucket) return null;
  const obj = await getS3().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const raw = await obj.Body?.transformToByteArray();
  return raw ? Buffer.from(raw) : null;
}

/**
 * Só encaminha para times cujo domínio está com recebimento ligado: um domínio
 * apenas de envio não deve virar caixa de entrada de ninguém.
 */
async function resolveTeam(recipients: string[]) {
  for (const rcpt of recipients) {
    const domainPart = rcpt.split("@")[1]?.toLowerCase();
    if (!domainPart) continue;
    const domain = await db.domain.findFirst({
      // Só domínios com recebimento ativo — e-mail para domínio sem opt-in de
      // recebimento é descartado (movido para processed/ sem registro).
      where: { name: domainPart, receivingEnabled: true },
      select: { id: true, teamId: true },
    });
    if (domain) return domain;
  }
  return null;
}

function addressList(value: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .flatMap((entry) => entry.value.map((v) => v.address ?? ""))
    .filter(Boolean);
}

// Corpo no payload do webhook é truncado — o WebhookCall persiste o payload
// inteiro no Postgres e endpoints não devem receber corpos de vários MB.
// O corpo completo continua disponível via API pelo email_id.
const WEBHOOK_BODY_LIMIT = 64 * 1024;

function truncateBody(value: string | null) {
  if (value && value.length > WEBHOOK_BODY_LIMIT) {
    return { value: value.slice(0, WEBHOOK_BODY_LIMIT), truncated: true };
  }
  return { value, truncated: false };
}

function buildInboundPayload(
  inbound: {
    id: string;
    domainId: number | null;
    messageId: string | null;
    fromEmail: string;
    fromName: string | null;
    to: string[];
    cc: string[];
    bcc: string[];
    replyTo: string[];
    subject: string | null;
    textBody: string | null;
    htmlBody: string | null;
    spamVerdict: string | null;
    receivedAt: Date;
  },
  parsed: ParsedMail,
): EmailReceivedPayload {
  const text = truncateBody(inbound.textBody);
  const html = truncateBody(inbound.htmlBody);

  return {
    email_id: inbound.id,
    message_id: inbound.messageId,
    domain_id: inbound.domainId,
    from: { email: inbound.fromEmail, name: inbound.fromName },
    to: inbound.to,
    cc: inbound.cc,
    bcc: inbound.bcc,
    reply_to: inbound.replyTo,
    subject: inbound.subject,
    text: text.value,
    html: html.value,
    truncated: text.truncated || html.truncated,
    headers: parsed.headerLines.map((h) => ({
      name: h.key,
      value: h.line.slice(h.line.indexOf(":") + 1).trim(),
    })),
    attachments: (parsed.attachments ?? []).map((a) => ({
      filename: a.filename ?? "sem-nome",
      content_type: a.contentType,
      size: a.size,
    })),
    spam_verdict: inbound.spamVerdict,
    received_at: inbound.receivedAt.toISOString(),
  };
}

async function processObject(bucket: string, key: string) {
  const raw = await baixarMimeBruto(key);
  if (!raw) return;

  const parsed = await simpleParser(raw);

  const toAddresses = (
    Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : []
  ).flatMap((t) => t.value.map((v) => v.address ?? ""));
  const envelope = extrairDestinatariosDeEnvelope(
    parsed.headers.get("received") as string | string[] | undefined,
  );
  const recipients = [...envelope, ...toAddresses].filter(Boolean);

  // O objeto termina em processed/; gravar a chave final evita que o
  // encaminhamento (e qualquer releitura futura) procure onde já não está.
  const doneKey = PREFIX_DONE + key.slice(PREFIX_NEW.length);

  const domain = await resolveTeam(recipients);
  if (!domain) {
    logger.warn(
      { key, recipients },
      "[Inbound] Nenhum domínio/time para os destinatários — ignorando",
    );
  } else {
    const from = parsed.from?.value[0];
    const spamVerdictHeader = parsed.headerLines.find(
      (h) => h.key === "x-ses-spam-verdict",
    );
    try {
      const inbound = await db.inboundEmail.create({
        data: {
          teamId: domain.teamId,
          domainId: domain.id,
          s3Key: doneKey,
          messageId: parsed.messageId ?? null,
          fromEmail: from?.address ?? "desconhecido",
          fromName: from?.name || null,
          to: recipients,
          cc: addressList(parsed.cc),
          bcc: addressList(parsed.bcc),
          replyTo: addressList(parsed.replyTo),
          subject: parsed.subject ?? null,
          textBody: parsed.text ?? null,
          htmlBody: typeof parsed.html === "string" ? parsed.html : null,
          headers: parsed.headerLines.map((h) => ({
            name: h.key,
            value: h.line.slice(h.line.indexOf(":") + 1).trim(),
          })),
          attachments: (parsed.attachments ?? []).map((a) => ({
            filename: a.filename ?? "sem-nome",
            contentType: a.contentType,
            size: a.size,
          })),
          spamVerdict: spamVerdictHeader
            ? spamVerdictHeader.line
                .slice(spamVerdictHeader.line.indexOf(":") + 1)
                .trim()
            : null,
          receivedAt: parsed.date ?? new Date(),
        },
      });
      logger.info(
        { key, teamId: domain.teamId, subject: parsed.subject },
        "[Inbound] E-mail recebido salvo",
      );

      // Move antes de encaminhar: o job de encaminhamento lê o MIME em
      // processed/ e não pode correr contra a cópia.
      await moverParaProcessados(bucket, key, doneKey);

      await enfileirarEncaminhamentos({
        inboundEmailId: inbound.id,
        teamId: domain.teamId,
        domainId: domain.id,
      });

      // Emite só após persistir: o s3Key único garante no máximo 1 emissão
      // por objeto (o perdedor da corrida cai no catch P2002 e não emite).
      // Falha no emit não pode perder o e-mail nem impedir o move para
      // processed/ — a entrega do webhook em si já tem retry na fila.
      try {
        await WebhookService.emit(
          inbound.teamId,
          "email.received",
          buildInboundPayload(inbound, parsed),
          { domainId: inbound.domainId },
        );
      } catch (err) {
        logger.error(
          { inboundId: inbound.id, err },
          "[Inbound] Falha ao emitir webhook email.received",
        );
      }
      return;
    } catch (e) {
      // s3Key único — objeto já processado em corrida anterior.
      if ((e as { code?: string }).code !== "P2002") {
        const isDup =
          e instanceof Error && e.message.includes("Unique constraint");
        if (!isDup) throw e;
      }
    }
  }

  await moverParaProcessados(bucket, key, doneKey);
}

/** Move o objeto para processed/ (auditoria) e remove da fila. */
async function moverParaProcessados(
  bucket: string,
  key: string,
  doneKey: string,
) {
  await getS3().send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${encodeURIComponent(key)}`,
      Key: doneKey,
    }),
  );
  await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Puxa e processa os e-mails novos do bucket (chamado pelo job de polling). */
export async function pollInboundEmails() {
  const bucket = env.INBOUND_S3_BUCKET;
  if (!bucket) return;

  const list = await getS3().send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: PREFIX_NEW,
      MaxKeys: 50,
    }),
  );

  for (const item of list.Contents ?? []) {
    if (!item.Key || item.Key.endsWith("/")) continue;
    // AMAZON_SES_SETUP_NOTIFICATION é um objeto de teste criado pelo SES.
    if (item.Key.includes("AMAZON_SES_SETUP_NOTIFICATION")) continue;
    try {
      await processObject(bucket, item.Key);
    } catch (e) {
      logger.error({ key: item.Key, err: e }, "[Inbound] Falha ao processar");
    }
  }
}
