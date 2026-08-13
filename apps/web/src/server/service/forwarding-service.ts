import { ForwardingRuleStatus, ForwardStatus } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { env } from "~/env";
import { db } from "../db";
import { getRedis, BULL_PREFIX } from "../redis";
import {
  DEFAULT_QUEUE_OPTIONS,
  FORWARD_DISPATCH_QUEUE,
} from "../queue/queue-constants";
import { createWorkerHandler, TeamJob } from "../queue/bullmq-context";
import { logger } from "../logger/log";
import { sendRawMime } from "../aws/ses";
import { getConfigurationSetName } from "~/utils/ses-utils";
import {
  motivoParaDescartar,
  reescreverParaEncaminhamento,
  separarMime,
} from "../utils/mime-forward";
import { enviarConfirmacaoDeEncaminhamento } from "./forwarding-mailer";

const FORWARD_CONCURRENCY = 10;
const FORWARD_MAX_ATTEMPTS = 4;
const FORWARD_BASE_BACKOFF_MS = 10_000;
/** Teto por regra por hora: uma caixa sob avalanche não derruba a reputação. */
export const LIMITE_POR_REGRA_HORA = 200;
/** Falhas seguidas até desativar a regra (destino morto). */
export const FALHAS_ATE_DESATIVAR = 5;
/** Prefixo do remetente reescrito, no domínio do próprio cliente. */
const LOCALPART_REMETENTE = "encaminhamento";

type ForwardJobData = { forwardId: string; teamId?: number };

export class ForwardQueueService {
  private static queue = new Queue<ForwardJobData>(FORWARD_DISPATCH_QUEUE, {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
    defaultJobOptions: {
      ...DEFAULT_QUEUE_OPTIONS,
      attempts: FORWARD_MAX_ATTEMPTS,
      backoff: { type: "exponential", delay: FORWARD_BASE_BACKOFF_MS },
    },
  });

  private static worker = new Worker(
    FORWARD_DISPATCH_QUEUE,
    createWorkerHandler(processarEncaminhamento),
    {
      connection: getRedis(),
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
      concurrency: FORWARD_CONCURRENCY,
    },
  );

  static {
    this.worker.on("error", (error) => {
      logger.error({ error }, "[Forwarding]: Worker error");
    });
    logger.info("[Forwarding]: fila de encaminhamento iniciada");
  }

  public static async enfileirar(forwardId: string, teamId: number) {
    await this.queue.add(forwardId, { forwardId, teamId }, { jobId: forwardId });
  }
}

/**
 * Regras que valem para um e-mail recebido: as do domínio de destino mais as
 * curinga (`domainId` nulo) do time. Só as confirmadas e ativas entram.
 */
export async function enfileirarEncaminhamentos(params: {
  inboundEmailId: string;
  teamId: number;
  domainId: number | null;
}) {
  const regras = await db.forwardingRule.findMany({
    where: {
      teamId: params.teamId,
      status: ForwardingRuleStatus.ACTIVE,
      OR: [{ domainId: null }, { domainId: params.domainId }],
    },
    select: { id: true },
  });

  for (const regra of regras) {
    try {
      const forward = await db.inboundForward.create({
        data: {
          ruleId: regra.id,
          teamId: params.teamId,
          inboundEmailId: params.inboundEmailId,
        },
      });
      await ForwardQueueService.enfileirar(forward.id, params.teamId);
    } catch (e) {
      // Único por (regra, e-mail): reprocessar o mesmo objeto não duplica envio.
      const duplicado =
        (e as { code?: string }).code === "P2002" ||
        (e instanceof Error && e.message.includes("Unique constraint"));
      if (!duplicado) throw e;
    }
  }
}

async function marcarPulado(forwardId: string, motivo: string) {
  await db.inboundForward.update({
    where: { id: forwardId },
    data: { status: ForwardStatus.SKIPPED, lastError: motivo },
  });
  logger.info({ forwardId, motivo }, "[Forwarding]: encaminhamento descartado");
}

async function processarEncaminhamento(job: TeamJob<ForwardJobData>) {
  const { forwardId } = job.data;
  const tentativa = job.attemptsMade + 1;

  const forward = await db.inboundForward.findUnique({
    where: { id: forwardId },
    include: { rule: true, inboundEmail: true },
  });

  if (!forward) {
    logger.warn({ forwardId }, "[Forwarding]: registro não encontrado");
    return;
  }

  if (forward.status === ForwardStatus.SENT) return;

  const { rule, inboundEmail } = forward;

  if (rule.status !== ForwardingRuleStatus.ACTIVE) {
    await marcarPulado(forwardId, `regra ${rule.status}`);
    return;
  }

  const desdeUmaHora = new Date(Date.now() - 60 * 60 * 1000);
  const enviadosNaHora = await db.inboundForward.count({
    where: {
      ruleId: rule.id,
      status: ForwardStatus.SENT,
      updatedAt: { gte: desdeUmaHora },
    },
  });
  if (enviadosNaHora >= LIMITE_POR_REGRA_HORA) {
    await marcarPulado(
      forwardId,
      `limite de ${LIMITE_POR_REGRA_HORA} encaminhamentos por hora atingido`,
    );
    return;
  }

  const dominio = inboundEmail.domainId
    ? await db.domain.findUnique({ where: { id: inboundEmail.domainId } })
    : null;

  if (!dominio) {
    await marcarPulado(forwardId, "domínio de origem não existe mais");
    return;
  }

  const { baixarMimeBruto } = await import("./inbound-service");
  const raw = await baixarMimeBruto(inboundEmail.s3Key);

  if (!raw) {
    await marcarPulado(forwardId, "MIME original indisponível no S3");
    return;
  }

  const { cabecalhos } = separarMime(raw);
  const motivo = motivoParaDescartar(cabecalhos);
  if (motivo) {
    await marcarPulado(forwardId, motivo);
    return;
  }

  const remetente = `${LOCALPART_REMETENTE}@${dominio.name}`;
  const mime = reescreverParaEncaminhamento({
    raw,
    remetenteEnvelope: remetente,
    nomeOriginal: inboundEmail.fromName,
    emailOriginal: inboundEmail.fromEmail,
    ruleId: rule.id,
  });

  try {
    const configurationSetName = await getConfigurationSetName(
      false,
      false,
      dominio.region,
    );

    const sesMessageId = await sendRawMime({
      raw: mime,
      from: remetente,
      to: [rule.destination],
      region: dominio.region,
      configurationSetName: configurationSetName ?? undefined,
      sesTenantId: dominio.sesTenantId,
    });

    await db.$transaction([
      db.inboundForward.update({
        where: { id: forwardId },
        data: {
          status: ForwardStatus.SENT,
          attempt: tentativa,
          sesMessageId: sesMessageId ?? null,
          lastError: null,
        },
      }),
      db.forwardingRule.update({
        where: { id: rule.id },
        data: {
          forwardedCount: { increment: 1 },
          consecutiveFailures: 0,
          lastForwardedAt: new Date(),
        },
      }),
    ]);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    const ultimaTentativa = tentativa >= FORWARD_MAX_ATTEMPTS;

    await db.inboundForward.update({
      where: { id: forwardId },
      data: {
        status: ultimaTentativa ? ForwardStatus.FAILED : ForwardStatus.PENDING,
        attempt: tentativa,
        lastError: mensagem.slice(0, 500),
      },
    });

    if (ultimaTentativa) {
      await registrarFalhaDaRegra(rule.id, mensagem);
    }

    throw erro;
  }
}

/**
 * Falha definitiva (envio recusado ou bounce duro no destino). Depois de
 * algumas seguidas a regra é desativada: insistir em caixa morta é o caminho
 * mais curto para queimar a reputação do domínio do cliente.
 */
export async function registrarFalhaDaRegra(ruleId: string, motivo: string) {
  const regra = await db.forwardingRule.update({
    where: { id: ruleId },
    data: {
      failedCount: { increment: 1 },
      consecutiveFailures: { increment: 1 },
      lastFailureAt: new Date(),
    },
  });

  if (
    regra.consecutiveFailures >= FALHAS_ATE_DESATIVAR &&
    regra.status === ForwardingRuleStatus.ACTIVE
  ) {
    await db.forwardingRule.update({
      where: { id: ruleId },
      data: { status: ForwardingRuleStatus.DISABLED_BOUNCED },
    });
    logger.warn(
      { ruleId, motivo },
      "[Forwarding]: regra desativada por falhas seguidas",
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                              Regras (CRUD)                                 */
/* -------------------------------------------------------------------------- */

export function urlDeConfirmacao(token: string) {
  const base = env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  return `${base}/confirmar-encaminhamento?token=${token}`;
}

export async function listarRegras(teamId: number) {
  return db.forwardingRule.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    include: { domain: { select: { id: true, name: true } } },
  });
}

/**
 * Criar a regra não liga o encaminhamento: o destino precisa confirmar por
 * e-mail (double opt-in). Sem isso qualquer cliente poderia despejar tráfego
 * na caixa de um terceiro só digitando o endereço.
 */
export async function criarRegra(params: {
  teamId: number;
  userId?: number;
  domainId: number | null;
  destination: string;
}) {
  const destino = params.destination.trim().toLowerCase();

  if (params.domainId != null) {
    const dominio = await db.domain.findFirst({
      where: { id: params.domainId, teamId: params.teamId },
      select: { id: true, receivingEnabled: true },
    });
    if (!dominio) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Domínio não encontrado",
      });
    }
    if (!dominio.receivingEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Ligue o recebimento neste domínio antes de encaminhar",
      });
    }
  } else {
    const temRecebimento = await db.domain.count({
      where: { teamId: params.teamId, receivingEnabled: true },
    });
    if (temRecebimento === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhum domínio com recebimento ligado",
      });
    }
  }

  const jaExiste = await db.forwardingRule.findFirst({
    where: {
      teamId: params.teamId,
      domainId: params.domainId,
      destination: destino,
    },
  });
  if (jaExiste) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Já existe uma regra para este destino",
    });
  }

  const token = randomBytes(24).toString("hex");

  const regra = await db.forwardingRule.create({
    data: {
      teamId: params.teamId,
      domainId: params.domainId,
      destination: destino,
      createdByUserId: params.userId,
      verificationToken: token,
      verificationSentAt: new Date(),
    },
  });

  await enviarConfirmacaoDeEncaminhamento(destino, urlDeConfirmacao(token));

  return regra;
}

export async function reenviarConfirmacao(teamId: number, ruleId: string) {
  const regra = await db.forwardingRule.findFirst({
    where: { id: ruleId, teamId },
  });
  if (!regra) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Regra não encontrada" });
  }
  if (regra.status !== ForwardingRuleStatus.PENDING_VERIFICATION) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Este destino já foi confirmado",
    });
  }

  const token = randomBytes(24).toString("hex");
  await db.forwardingRule.update({
    where: { id: ruleId },
    data: { verificationToken: token, verificationSentAt: new Date() },
  });

  await enviarConfirmacaoDeEncaminhamento(
    regra.destination,
    urlDeConfirmacao(token),
  );
}

/** Confirmação vinda do link do e-mail — rota pública, sem sessão. */
export async function confirmarDestino(token: string) {
  const regra = await db.forwardingRule.findUnique({
    where: { verificationToken: token },
  });

  if (!regra) return { ok: false as const };

  if (regra.status !== ForwardingRuleStatus.PENDING_VERIFICATION) {
    return { ok: true as const, destino: regra.destination, jaConfirmado: true };
  }

  await db.forwardingRule.update({
    where: { id: regra.id },
    data: {
      status: ForwardingRuleStatus.ACTIVE,
      verifiedAt: new Date(),
      verificationToken: null,
      consecutiveFailures: 0,
    },
  });

  return { ok: true as const, destino: regra.destination, jaConfirmado: false };
}

export async function definirStatus(
  teamId: number,
  ruleId: string,
  ativar: boolean,
) {
  const regra = await db.forwardingRule.findFirst({
    where: { id: ruleId, teamId },
  });
  if (!regra) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Regra não encontrada" });
  }
  if (!regra.verifiedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O destino ainda não confirmou o encaminhamento",
    });
  }

  return db.forwardingRule.update({
    where: { id: ruleId },
    data: {
      status: ativar
        ? ForwardingRuleStatus.ACTIVE
        : ForwardingRuleStatus.PAUSED,
      consecutiveFailures: ativar ? 0 : regra.consecutiveFailures,
    },
  });
}

export async function removerRegra(teamId: number, ruleId: string) {
  const regra = await db.forwardingRule.findFirst({
    where: { id: ruleId, teamId },
  });
  if (!regra) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Regra não encontrada" });
  }
  await db.forwardingRule.delete({ where: { id: ruleId } });
}

export async function listarEntregas(teamId: number, ruleId: string) {
  return db.inboundForward.findMany({
    where: { teamId, ruleId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      inboundEmail: {
        select: { subject: true, fromEmail: true, receivedAt: true },
      },
    },
  });
}
