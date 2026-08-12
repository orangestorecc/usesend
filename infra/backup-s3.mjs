#!/usr/bin/env node
//
// Envia o dump para o S3 e apaga os antigos.
//
// Usa o @aws-sdk/client-s3 que o app já tem instalado, em vez de exigir o AWS
// CLI dentro do container — é uma dependência a menos para manter numa caixa
// que não tem gerenciador de pacotes rodando.
//
// Uso: node backup-s3.mjs <arquivo> <chave>

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// O SDK é dependência de apps/web e o pnpm isola node_modules por pacote. Um
// `import` normal resolveria a partir da pasta deste arquivo (infra/) e não
// acharia nada — `cd` não ajuda, porque ESM resolve pelo caminho do módulo e
// não pelo diretório de trabalho.
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const [arquivo, chave] = process.argv.slice(2);
if (!arquivo || !chave) {
  console.error("uso: node backup-s3.mjs <arquivo> <chave>");
  process.exit(2);
}

const {
  S3_COMPATIBLE_API_URL: endpoint,
  S3_COMPATIBLE_ACCESS_KEY: accessKeyId,
  S3_COMPATIBLE_SECRET_KEY: secretAccessKey,
  S3_COMPATIBLE_BUCKET: bucket,
  BACKUP_REMOTE_RETENTION_DAYS: retencaoBruta,
} = process.env;

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("S3 não configurado");
  process.exit(1);
}

const retencaoDias = Number(retencaoBruta ?? 30);
const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

await s3.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: chave,
    Body: readFileSync(arquivo),
    ContentType: "application/gzip",
  }),
);
console.log(`enviado para s3://${bucket}/${chave}`);

// Limpeza por data do próprio objeto, não pelo nome: se alguém renomear um
// arquivo, o critério continua valendo.
const limite = Date.now() - retencaoDias * 24 * 60 * 60 * 1000;
const lista = await s3.send(
  new ListObjectsV2Command({ Bucket: bucket, Prefix: "backups/postgres/" }),
);

for (const objeto of lista.Contents ?? []) {
  if (!objeto.Key || !objeto.LastModified) continue;
  if (objeto.LastModified.getTime() < limite) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objeto.Key }));
    console.log(`removido por retenção: ${objeto.Key}`);
  }
}

const restantes = (lista.Contents ?? []).filter(
  (o) => o.LastModified && o.LastModified.getTime() >= limite,
).length;
console.log(`backups no S3: ${restantes + 1}`);
