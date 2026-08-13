import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";
import { env } from "~/env";
import { db } from "../db";
import { logger } from "../logger/log";
import { getAwsCredentialOptions } from "~/server/aws/credentials";
import { enfileirarEncaminhamentos } from "./forwarding-service";
import { extrairDestinatariosDeEnvelope } from "../utils/inbound-recipients";

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
      where: { name: domainPart, receivingEnabled: true },
      select: { id: true, teamId: true },
    });
    if (domain) return domain;
  }
  return null;
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
          subject: parsed.subject ?? null,
          textBody: parsed.text ?? null,
          htmlBody: typeof parsed.html === "string" ? parsed.html : null,
          receivedAt: parsed.date ?? new Date(),
        },
      });
      logger.info(
        { key, teamId: domain.teamId, subject: parsed.subject },
        "[Inbound] E-mail recebido salvo",
      );

      // Move antes de enfileirar: o job de encaminhamento lê o MIME em
      // processed/ e não pode correr contra a cópia.
      await moverParaProcessados(bucket, key, doneKey);

      await enfileirarEncaminhamentos({
        inboundEmailId: inbound.id,
        teamId: domain.teamId,
        domainId: domain.id,
      });
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
