import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

let S3: S3Client | null = null;
export const DEFAULT_BUCKET = env.S3_COMPATIBLE_BUCKET || "unsend";

export const isStorageConfigured = () =>
  !!(
    env.S3_COMPATIBLE_ACCESS_KEY &&
    env.S3_COMPATIBLE_API_URL &&
    env.S3_COMPATIBLE_PUBLIC_URL &&
    env.S3_COMPATIBLE_SECRET_KEY
  );

const getClient = () => {
  if (
    !S3 &&
    env.S3_COMPATIBLE_ACCESS_KEY &&
    env.S3_COMPATIBLE_API_URL &&
    env.S3_COMPATIBLE_PUBLIC_URL &&
    env.S3_COMPATIBLE_SECRET_KEY
  ) {
    S3 = new S3Client({
      region: "auto",
      endpoint: env.S3_COMPATIBLE_API_URL,
      credentials: {
        accessKeyId: env.S3_COMPATIBLE_ACCESS_KEY,
        secretAccessKey: env.S3_COMPATIBLE_SECRET_KEY,
      },
      forcePathStyle: true, // needed for minio
    });
  }

  return S3;
};

export const getDocumentUploadUrl = async (
  key: string,
  fileType: string,
  bucket: string = DEFAULT_BUCKET
) => {
  const s3Client = getClient();

  if (!s3Client) {
    throw new Error("R2 is not configured");
  }

  const url = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
    }),
    {
      expiresIn: 3600,
      signableHeaders: new Set(["content-type"]),
    }
  );

  return url;
};

/** Sobe um arquivo direto pelo servidor, sem expor o bucket ao navegador. */
export const putDocument = async (
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
  bucket: string = DEFAULT_BUCKET
) => {
  const s3Client = getClient();
  if (!s3Client) {
    throw new Error("Armazenamento de arquivos não está configurado");
  }
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
};

/**
 * URL temporária de download. Curta de proposito: o arquivo de importacao tem
 * dados pessoais e nao pode virar link publico compartilhavel.
 */
export const getDocumentDownloadUrl = async (
  key: string,
  fileName: string,
  bucket: string = DEFAULT_BUCKET
) => {
  const s3Client = getClient();
  if (!s3Client) {
    throw new Error("Armazenamento de arquivos não está configurado");
  }
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
    }),
    { expiresIn: 300 }
  );
};

/**
 * Remove um objeto. Usado pela retenção: bloquear o download não basta — o
 * arquivo com dados pessoais precisa sair do bucket.
 */
export const deleteDocument = async (
  key: string,
  bucket: string = DEFAULT_BUCKET,
) => {
  const client = getClient();
  if (!client) return false;

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  );
  return true;
};
