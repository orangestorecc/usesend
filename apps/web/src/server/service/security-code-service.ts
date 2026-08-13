import { createHmac, randomInt, timingSafeEqual } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "~/server/db";
import { env } from "~/env";

/**
 * Finalidades dos códigos. Cada uma tem cota de envio própria — esgotar o
 * reenvio da troca de e-mail não pode travar um código de exclusão.
 */
export const SECURITY_CODE_PURPOSES = [
  "MFA_LOGIN",
  "MFA_ENABLE",
  "EMAIL_CHANGE_CURRENT",
  "EMAIL_CHANGE_NEW",
  "EMAIL_CHANGE_REVERT",
  "ACCOUNT_DELETE",
] as const;

export type SecurityCodePurpose = (typeof SECURITY_CODE_PURPOSES)[number];

/** 5 caracteres, igual ao OTP de login: um componente, uma expectativa. */
const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";
const TAMANHO = 5;
export const CODE_TTL_MINUTOS = 10;
export const MAX_TENTATIVAS = 5;
const PEPPER_VERSION = 1;

type Cliente = PrismaClient | Prisma.TransactionClient;

function pepper(): string {
  const valor = env.SECURITY_CODE_PEPPER;
  if (!valor) {
    // Sem pepper o HMAC vira sha256 puro e um dump do banco passa a valer
    // ataque offline — melhor falhar alto do que degradar em silêncio.
    throw new Error(
      "SECURITY_CODE_PEPPER não configurado; códigos de segurança desabilitados",
    );
  }
  return valor;
}

export function gerarCodigo(): string {
  let saida = "";
  for (let i = 0; i < TAMANHO; i++) {
    saida += ALFABETO[randomInt(ALFABETO.length)];
  }
  return saida;
}

export function hmacDoCodigo(codigo: string): string {
  return createHmac("sha256", pepper())
    .update(codigo.trim().toLowerCase())
    .digest("hex");
}

/** Comparação em tempo constante — o HMAC é hex, então o tamanho é fixo. */
function iguais(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Cria um código novo e invalida os anteriores da mesma finalidade — dois
 * códigos válidos ao mesmo tempo dobram a chance de acerto por tentativa.
 */
export async function emitirCodigo(
  userId: number,
  purpose: SecurityCodePurpose,
  opcoes: { sentTo?: string; cliente?: Cliente } = {},
): Promise<string> {
  const cliente = opcoes.cliente ?? db;
  const codigo = gerarCodigo();

  await cliente.securityCode.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await cliente.securityCode.create({
    data: {
      userId,
      purpose,
      codeHmac: hmacDoCodigo(codigo),
      pepperVersion: PEPPER_VERSION,
      sentTo: opcoes.sentTo,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTOS * 60 * 1000),
    },
  });

  return codigo;
}

export type ResultadoVerificacao =
  | { ok: true }
  | { ok: false; motivo: "inexistente" | "expirado" | "excedido" | "incorreto" };

/**
 * Consome o código. O incremento de tentativas acontece mesmo quando o código
 * está errado — é ele que fecha a força bruta dentro da janela de 10 minutos.
 */
export async function consumirCodigo(
  userId: number,
  purpose: SecurityCodePurpose,
  codigo: string,
  cliente: Cliente = db,
): Promise<ResultadoVerificacao> {
  const registro = await cliente.securityCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!registro) return { ok: false, motivo: "inexistente" };
  if (registro.expiresAt.getTime() < Date.now()) {
    return { ok: false, motivo: "expirado" };
  }
  if (registro.attempts >= MAX_TENTATIVAS) {
    return { ok: false, motivo: "excedido" };
  }

  if (!iguais(registro.codeHmac, hmacDoCodigo(codigo))) {
    await cliente.securityCode.update({
      where: { id: registro.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, motivo: "incorreto" };
  }

  // Consumo atômico: o `consumedAt: null` no where impede que duas
  // requisições simultâneas usem o mesmo código.
  const consumido = await cliente.securityCode.updateMany({
    where: { id: registro.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumido.count === 0) return { ok: false, motivo: "inexistente" };

  return { ok: true };
}
