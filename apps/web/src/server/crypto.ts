import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { env } from "~/env";

// Chave simétrica derivada do segredo do app (NEXTAUTH_SECRET). Usada para
// guardar segredos de TERCEIROS de forma RECUPERÁVEL (ex: API key da OrangeStore),
// diferente dos hashes irreversíveis abaixo (que só validam tokens nossos).
function getEncryptionKey() {
  const master = env.NEXTAUTH_SECRET ?? "madmail-fallback-secret";
  return scryptSync(master, "platform-integration", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Formato de segredo criptografado inválido");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export const createSecureHash = async (key: string) => {
  const data = new TextEncoder().encode(key);
  const salt = randomBytes(16).toString("hex");

  const derivedKey = scryptSync(data, salt, 64);

  return `${salt}:${derivedKey.toString("hex")}`;
};

export const verifySecureHash = async (key: string, hash: string) => {
  const data = new TextEncoder().encode(key);

  const [salt, storedHash] = hash.split(":");
  const derivedKey = scryptSync(data, String(salt), 64);

  return storedHash === derivedKey.toString("hex");
};
