import { EmailStatus, Prisma, ReputationState } from "@prisma/client";
import { db } from "../db";
import { logger } from "../logger/log";
import { getRedis, redisKey, withCache } from "../redis";

/**
 * Controle de bounce — ver docs-spec/BOUNCE-CONTROL-SPEC.md
 *
 * Duas decisoes carregam o resto do arquivo:
 *
 * 1. A taxa e medida numa JANELA DESLIZANTE (padrao 30 dias), nunca no
 *    acumulado vitalicio de CumulatedMetrics. Com o acumulado, uma conta com
 *    historico ruim nunca se recuperaria.
 * 2. O bloqueio exige tres travas simultaneas (volume minimo, taxa alta na
 *    janela longa E na curta, confirmada em duas leituras). Um unico disparo
 *    ruim de baixo volume nao bloqueia ninguem.
 */

export type ReputationPolicyResolved = {
  windowDays: number;
  shortWindowSize: number;
  minVolume: number;
  minBounces: number;
  warningRate: number;
  criticalRate: number;
  blockRate: number;
  unblockRate: number;
  minRecoveryVolume: number;
  autoBlock: boolean;
  supervisedLimit: number;
};

export type ReputationSnapshot = {
  windowDays: number;
  delivered: number;
  hardBounced: number;
  complained: number;
  /** entregas com veredito = delivered + hardBounced */
  sampleSize: number;
  bounceRate: number;
  complaintRate: number;
  shortWindow: {
    size: number;
    sampleSize: number;
    hardBounced: number;
    bounceRate: number;
  };
  sampleSufficient: boolean;
  computedAt: string;
};

export type ReputationStatus = {
  state: ReputationState;
  snapshot: ReputationSnapshot;
  policy: ReputationPolicyResolved;
  blockedAt: Date | null;
  blockedReason: string | null;
  supervisedUntil: Date | null;
  supervisedLimit: number | null;
  /** pontos percentuais que faltam para o limiar de bloqueio (0 se ja passou) */
  distanceToBlock: number;
};

const SNAPSHOT_TTL_SECONDS = 300;

const DEFAULT_POLICY: ReputationPolicyResolved = {
  windowDays: 30,
  shortWindowSize: 1000,
  minVolume: 500,
  minBounces: 10,
  warningRate: 0.4,
  criticalRate: 1.0,
  blockRate: 2.0,
  unblockRate: 1.2,
  minRecoveryVolume: 200,
  autoBlock: false,
  supervisedLimit: 500,
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export class ReputationService {
  /**
   * Politica do time (override) caindo para a global. Se nem a global existir
   * (banco recem-migrado), usa os defaults do codigo — a engine nunca deve
   * quebrar por falta de configuracao.
   */
  static async getPolicy(teamId?: number): Promise<ReputationPolicyResolved> {
    const rows = await db.reputationPolicy.findMany({
      where: { OR: [{ teamId: null }, ...(teamId ? [{ teamId }] : [])] },
    });

    const global = rows.find((r) => r.teamId === null);
    const override = teamId ? rows.find((r) => r.teamId === teamId) : undefined;
    const row = override ?? global;

    if (!row) return { ...DEFAULT_POLICY };

    return {
      windowDays: row.windowDays,
      shortWindowSize: row.shortWindowSize,
      minVolume: row.minVolume,
      minBounces: row.minBounces,
      warningRate: toNumber(row.warningRate),
      criticalRate: toNumber(row.criticalRate),
      blockRate: toNumber(row.blockRate),
      unblockRate: toNumber(row.unblockRate),
      minRecoveryVolume: row.minRecoveryVolume,
      autoBlock: row.autoBlock,
      supervisedLimit: row.supervisedLimit,
    };
  }

  /**
   * Taxa da janela longa (DailyEmailUsage) + janela curta (ultimos N eventos
   * com veredito). A janela curta existe para provar que o problema e ATUAL:
   * sem ela, um pico de 25 dias atras ainda bloquearia a conta hoje.
   */
  static async computeSnapshot(
    teamId: number,
    options?: { domainId?: number; policy?: ReputationPolicyResolved },
  ): Promise<ReputationSnapshot> {
    const policy = options?.policy ?? (await this.getPolicy(teamId));
    const { domainId } = options ?? {};

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (policy.windowDays - 1));
    const sinceDate = since.toISOString().split("T")[0] as string;

    const usage = await db.dailyEmailUsage.aggregate({
      where: {
        teamId,
        date: { gte: sinceDate },
        ...(domainId ? { domainId } : {}),
      },
      _sum: { delivered: true, hardBounced: true, complained: true },
    });

    const delivered = usage._sum.delivered ?? 0;
    const hardBounced = usage._sum.hardBounced ?? 0;
    const complained = usage._sum.complained ?? 0;
    // Denominador: entregas com veredito. "sent" incluiria mensagens ainda sem
    // retorno do provedor e inflaria a taxa nas primeiras horas de campanha.
    const sampleSize = delivered + hardBounced;

    const shortWindow = await this.computeShortWindow(
      teamId,
      policy.shortWindowSize,
    );

    return {
      windowDays: policy.windowDays,
      delivered,
      hardBounced,
      complained,
      sampleSize,
      bounceRate: rate(hardBounced, sampleSize),
      complaintRate: rate(complained, sampleSize),
      shortWindow,
      sampleSufficient:
        sampleSize >= policy.minVolume && hardBounced >= policy.minBounces,
      computedAt: new Date().toISOString(),
    };
  }

  /** Snapshot com cache (invalidado a cada webhook de bounce do SES). */
  static async getSnapshotCached(teamId: number): Promise<ReputationSnapshot> {
    return withCache(
      `reputation:snapshot:${teamId}`,
      () => this.computeSnapshot(teamId),
      { ttlSeconds: SNAPSHOT_TTL_SECONDS },
    );
  }

  static async invalidateSnapshot(teamId: number) {
    try {
      await getRedis().del(redisKey(`reputation:snapshot:${teamId}`));
    } catch (err) {
      // Cache frio e um detalhe de performance, nunca motivo para falhar o
      // processamento do webhook.
      logger.warn({ err, teamId }, "[Reputation]: falha ao invalidar snapshot");
    }
  }

  private static async computeShortWindow(teamId: number, size: number) {
    const events = await db.emailEvent.findMany({
      where: {
        teamId,
        status: { in: [EmailStatus.DELIVERED, EmailStatus.BOUNCED] },
      },
      select: { status: true, data: true },
      orderBy: { createdAt: "desc" },
      take: size,
    });

    let delivered = 0;
    let hardBounced = 0;
    for (const event of events) {
      if (event.status === EmailStatus.DELIVERED) {
        delivered += 1;
        continue;
      }
      // Só hard bounce conta. Soft bounce é transitório e o SES reenvia.
      const data = event.data as { bounceType?: string } | null;
      if (data?.bounceType === "Permanent") hardBounced += 1;
    }

    const sampleSize = delivered + hardBounced;
    return {
      size,
      sampleSize,
      hardBounced,
      bounceRate: rate(hardBounced, sampleSize),
    };
  }

  /** Estado persistido do time, criado sob demanda. */
  static async getState(teamId: number) {
    const existing = await db.teamReputationState.findUnique({
      where: { teamId },
    });
    if (existing) return existing;

    return db.teamReputationState.create({
      data: { teamId, state: ReputationState.HEALTHY },
    });
  }

  static async getStatus(teamId: number): Promise<ReputationStatus> {
    const [state, snapshot, policy] = await Promise.all([
      this.getState(teamId),
      this.getSnapshotCached(teamId),
      this.getPolicy(teamId),
    ]);

    return {
      state: state.state,
      snapshot,
      policy,
      blockedAt: state.blockedAt,
      blockedReason: state.blockedReason,
      supervisedUntil: state.supervisedUntil,
      supervisedLimit: state.supervisedLimit,
      distanceToBlock: Math.max(0, policy.blockRate - snapshot.bounceRate),
    };
  }

  /**
   * Faixa pura, sem as travas de bloqueio: só olha a taxa da janela longa.
   * Usada para os estados de alerta (WARNING/CRITICAL), que não bloqueiam nada
   * e por isso não precisam das confirmações.
   */
  static classify(
    snapshot: ReputationSnapshot,
    policy: ReputationPolicyResolved,
  ): ReputationState {
    const { bounceRate } = snapshot;
    if (bounceRate >= policy.criticalRate) return ReputationState.CRITICAL;
    if (bounceRate >= policy.warningRate) return ReputationState.WARNING;
    return ReputationState.HEALTHY;
  }

  /**
   * As tres travas anti-falso-positivo do bloqueio. Faltando qualquer uma, o
   * time no maximo chega a CRITICAL.
   */
  static shouldBlock(
    snapshot: ReputationSnapshot,
    policy: ReputationPolicyResolved,
  ): boolean {
    return (
      snapshot.sampleSufficient &&
      snapshot.bounceRate >= policy.blockRate &&
      snapshot.shortWindow.bounceRate >= policy.blockRate
    );
  }

  /**
   * Desbloqueio automatico com histerese: nao basta cair abaixo de blockRate,
   * tem que cair abaixo de unblockRate (evita flapping) E ter volume novo —
   * sem envio novo a taxa cairia so por decaimento da janela, sem prova de
   * recuperacao.
   */
  static canUnblock(
    snapshot: ReputationSnapshot,
    policy: ReputationPolicyResolved,
    sampleAtBlock: number | null,
  ): boolean {
    const newVolume = snapshot.sampleSize - (sampleAtBlock ?? 0);
    return (
      snapshot.bounceRate < policy.unblockRate &&
      snapshot.shortWindow.bounceRate < policy.unblockRate &&
      newVolume >= policy.minRecoveryVolume
    );
  }

  /**
   * Confirmacao em duas leituras consecutivas separadas por >= 15 min.
   * Retorna true quando a condicao ja estava marcada de uma avaliacao anterior.
   */
  private static async confirmBlockCondition(teamId: number): Promise<boolean> {
    const redis = getRedis();
    const key = redisKey(`reputation:confirm:${teamId}`);
    try {
      const first = await redis.set(key, Date.now().toString(), "EX", 3600, "NX");
      if (first === "OK") return false; // primeira leitura: so marca

      const markedAt = Number(await redis.get(key));
      if (!markedAt) return false;
      return Date.now() - markedAt >= 15 * 60 * 1000;
    } catch (err) {
      // Fail-open no CALCULO: sem Redis, nao bloqueamos ninguem novo.
      // (O fail-closed vale para a APLICACAO do bloqueio ja existente.)
      logger.error(
        { err, teamId },
        "[Reputation]: Redis indisponivel — bloqueio automatico adiado",
      );
      return false;
    }
  }

  private static async clearBlockCondition(teamId: number) {
    try {
      await getRedis().del(redisKey(`reputation:confirm:${teamId}`));
    } catch {
      // irrelevante: a chave expira sozinha em 1h
    }
  }

  /**
   * Avalia um time e aplica a transicao de estado, se houver.
   * Idempotente: so grava ReputationEvent quando o estado muda de fato.
   */
  static async evaluateTeam(
    teamId: number,
    options?: { allowBlock?: boolean },
  ): Promise<ReputationState> {
    // allowBlock = false: o circuit breaker esta acionado. Continuamos medindo e
    // alertando, mas nenhum bloqueio novo e aplicado ate revisao humana.
    const allowBlock = options?.allowBlock ?? true;
    const policy = await this.getPolicy(teamId);
    const [state, snapshot] = await Promise.all([
      this.getState(teamId),
      this.computeSnapshot(teamId, { policy }),
    ]);

    // EXEMPT e decisao humana: a engine mede e alerta, mas nunca muda o estado.
    if (state.state === ReputationState.EXEMPT) {
      const stillExempt =
        !state.exemptUntil || state.exemptUntil.getTime() > Date.now();
      if (stillExempt) {
        await this.persistMeasurement(teamId, snapshot);
        return ReputationState.EXEMPT;
      }
    }

    const isBlocked =
      state.state === ReputationState.BLOCKED ||
      state.state === ReputationState.SUPERVISED;

    if (isBlocked) {
      const supervisionExpired =
        state.state === ReputationState.SUPERVISED &&
        state.supervisedUntil !== null &&
        state.supervisedUntil.getTime() <= Date.now();

      // Reincidencia durante a supervisao: volta a bloquear na hora, sem as
      // duas leituras — a conta ja provou o problema uma vez.
      if (
        state.state === ReputationState.SUPERVISED &&
        this.shouldBlock(snapshot, policy)
      ) {
        return this.transition(teamId, state.state, ReputationState.BLOCKED, {
          snapshot,
          reason: `Reincidencia durante liberacao assistida: ${snapshot.bounceRate.toFixed(2)}%`,
          sampleAtBlock: snapshot.sampleSize,
        });
      }

      if (this.canUnblock(snapshot, policy, state.sampleAtBlock)) {
        const next = this.classify(snapshot, policy);
        return this.transition(teamId, state.state, next, {
          snapshot,
          reason: `Recuperacao confirmada: ${snapshot.bounceRate.toFixed(2)}% com volume novo`,
        });
      }

      if (supervisionExpired) {
        return this.transition(
          teamId,
          state.state,
          ReputationState.BLOCKED,
          {
            snapshot,
            reason: "Prazo da liberacao assistida encerrado sem recuperacao",
            sampleAtBlock: state.sampleAtBlock ?? snapshot.sampleSize,
          },
        );
      }

      await this.persistMeasurement(teamId, snapshot);
      return state.state;
    }

    if (this.shouldBlock(snapshot, policy)) {
      const confirmed = await this.confirmBlockCondition(teamId);

      if (confirmed && policy.autoBlock && allowBlock) {
        return this.transition(teamId, state.state, ReputationState.BLOCKED, {
          snapshot,
          reason: `Taxa de retorno em ${snapshot.bounceRate.toFixed(2)}% (limite ${policy.blockRate}%)`,
          sampleAtBlock: snapshot.sampleSize,
        });
      }

      if (confirmed && (!policy.autoBlock || !allowBlock)) {
        // Shadow mode: registra o que TERIA acontecido, sem tocar no cliente.
        logger.warn(
          {
            teamId,
            bounceRate: snapshot.bounceRate,
            sampleSize: snapshot.sampleSize,
          },
          "[Reputation]: shadow mode — time seria bloqueado agora",
        );
      }

      // Enquanto nao confirma (ou em shadow mode) o time fica em CRITICAL.
      return this.transition(teamId, state.state, ReputationState.CRITICAL, {
        snapshot,
      });
    }

    await this.clearBlockCondition(teamId);
    const next = this.classify(snapshot, policy);
    return this.transition(teamId, state.state, next, { snapshot });
  }

  private static async persistMeasurement(
    teamId: number,
    snapshot: ReputationSnapshot,
  ) {
    await db.teamReputationState.update({
      where: { teamId },
      data: {
        bounceRate: new Prisma.Decimal(snapshot.bounceRate.toFixed(3)),
        complaintRate: new Prisma.Decimal(snapshot.complaintRate.toFixed(3)),
        sampleSize: snapshot.sampleSize,
        lastEvaluatedAt: new Date(),
      },
    });
  }

  /**
   * Aplica a transicao: estado, flag de bloqueio no Team, evento de auditoria e
   * disparo da regua de e-mails. Sem mudanca de estado, so atualiza a medicao.
   */
  static async transition(
    teamId: number,
    from: ReputationState,
    to: ReputationState,
    options: {
      snapshot: ReputationSnapshot;
      reason?: string;
      actor?: string;
      sampleAtBlock?: number;
      supervisedUntil?: Date | null;
      supervisedLimit?: number | null;
      exemptUntil?: Date | null;
    },
  ): Promise<ReputationState> {
    const { snapshot, reason, actor = "system" } = options;

    if (from === to) {
      await this.persistMeasurement(teamId, snapshot);
      return to;
    }

    const blocksSending =
      to === ReputationState.BLOCKED || to === ReputationState.SUPERVISED;
    const nowBlocked = to === ReputationState.BLOCKED;

    await db.$transaction([
      db.teamReputationState.update({
        where: { teamId },
        data: {
          state: to,
          bounceRate: new Prisma.Decimal(snapshot.bounceRate.toFixed(3)),
          complaintRate: new Prisma.Decimal(snapshot.complaintRate.toFixed(3)),
          sampleSize: snapshot.sampleSize,
          lastEvaluatedAt: new Date(),
          blockedAt: nowBlocked ? new Date() : blocksSending ? undefined : null,
          blockedReason: blocksSending ? (reason ?? null) : null,
          sampleAtBlock: options.sampleAtBlock ?? (blocksSending ? undefined : null),
          supervisedUntil:
            to === ReputationState.SUPERVISED
              ? (options.supervisedUntil ?? null)
              : null,
          supervisedLimit:
            to === ReputationState.SUPERVISED
              ? (options.supervisedLimit ?? null)
              : null,
          exemptUntil:
            to === ReputationState.EXEMPT ? (options.exemptUntil ?? null) : null,
        },
      }),
      // O bloqueio de envio mora em campo proprio do Team. NAO usar isBlocked:
      // o payment-service limpa isBlocked ao confirmar pagamento, e um pagamento
      // nao pode desbloquear uma conta com problema de reputacao.
      db.team.update({
        where: { id: teamId },
        data: {
          sendingBlockedAt: nowBlocked ? new Date() : null,
          sendingBlockedReason: nowBlocked ? (reason ?? "Taxa de retorno acima do limite") : null,
        },
      }),
      db.reputationEvent.create({
        data: {
          teamId,
          fromState: from,
          toState: to,
          bounceRate: new Prisma.Decimal(snapshot.bounceRate.toFixed(3)),
          sampleSize: snapshot.sampleSize,
          actor,
          reason,
        },
      }),
    ]);

    logger.info(
      { teamId, from, to, bounceRate: snapshot.bounceRate, actor, reason },
      "[Reputation]: transicao de estado",
    );

    // O gate de envio le o Team do cache (TTL 2 min). Sem este refresh, um time
    // recem-bloqueado continuaria enviando por ate dois minutos — e um time
    // recem-liberado ficaria travado pelo mesmo tempo.
    try {
      const { TeamService } = await import("./team-service");
      await TeamService.refreshTeamCache(teamId);
      await getRedis().del(redisKey(`reputation:supervised-limit:${teamId}`));
    } catch (err) {
      logger.warn({ err, teamId }, "[Reputation]: falha ao atualizar cache do time");
    }

    // Desbloqueou: as campanhas que a ENGINE pausou voltam a rodar do ponto em
    // que pararam (lastCursor). Campanhas pausadas pelo proprio cliente ficam
    // como estao — pausadas.
    const wasBlocked =
      from === ReputationState.BLOCKED || from === ReputationState.SUPERVISED;
    if (wasBlocked && !blocksSending) {
      try {
        await this.resumePausedCampaigns(teamId);
      } catch (err) {
        logger.error({ err, teamId }, "[Reputation]: falha ao retomar campanhas");
      }
    }

    // Notificacao nunca derruba a transicao.
    try {
      const { ReputationMailer } = await import("./reputation-mailer");
      await ReputationMailer.onTransition({ teamId, from, to, snapshot, reason });
    } catch (err) {
      logger.error({ err, teamId, from, to }, "[Reputation]: falha ao notificar");
    }

    return to;
  }

  private static async resumePausedCampaigns(teamId: number) {
    const campaigns = await db.campaign.findMany({
      where: {
        teamId,
        status: "PAUSED",
        pausedByReputationAt: { not: null },
      },
      select: { id: true },
    });

    if (campaigns.length === 0) return;

    const { CampaignBatchService } = await import("./campaign-service");

    for (const campaign of campaigns) {
      await db.campaign.update({
        where: { id: campaign.id },
        data: { status: "RUNNING", pausedByReputationAt: null },
      });
      await CampaignBatchService.queueBatch({ campaignId: campaign.id, teamId });
    }

    logger.info(
      { teamId, count: campaigns.length },
      "[Reputation]: campanhas retomadas apos desbloqueio",
    );
  }

  /** Times com envio recente — o job periodico nunca varre a base inteira. */
  static async listRecentlyActiveTeams(hours = 48): Promise<number[]> {
    const since = new Date();
    since.setUTCHours(since.getUTCHours() - hours);
    const sinceDate = since.toISOString().split("T")[0] as string;

    const rows = await db.dailyEmailUsage.findMany({
      where: { date: { gte: sinceDate } },
      select: { teamId: true },
      distinct: ["teamId"],
    });
    return rows.map((r) => r.teamId);
  }

  /**
   * Top ofensores da janela, para a tela de detalhes e para o MCP.
   * Agrupa por dominio do destinatario e por motivo devolvido pelo provedor.
   */
  static async getBounceBreakdown(
    teamId: number,
    options?: { days?: number; limit?: number },
  ) {
    const days = options?.days ?? 30;
    const limit = options?.limit ?? 10;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const events = await db.emailEvent.findMany({
      where: {
        teamId,
        status: EmailStatus.BOUNCED,
        createdAt: { gte: since },
      },
      select: { data: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const byDomain = new Map<string, number>();
    const byReason = new Map<string, number>();
    let total = 0;

    for (const event of events) {
      const data = event.data as
        | {
            bounceType?: string;
            bounceSubType?: string;
            bouncedRecipients?: { emailAddress?: string }[];
          }
        | null;
      if (data?.bounceType !== "Permanent") continue;
      total += 1;

      const reason = data.bounceSubType ?? "Undetermined";
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1);

      for (const recipient of data.bouncedRecipients ?? []) {
        const domain = recipient.emailAddress?.split("@")[1]?.toLowerCase();
        if (!domain) continue;
        byDomain.set(domain, (byDomain.get(domain) ?? 0) + 1);
      }
    }

    const top = (map: Map<string, number>) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key, count]) => ({
          key,
          count,
          share: total ? (count / total) * 100 : 0,
        }));

    return {
      days,
      totalHardBounces: total,
      byDomain: top(byDomain),
      byReason: top(byReason),
    };
  }

  /** Série diária da janela, para o gráfico da página /reputation. */
  static async getTimeSeries(
    teamId: number,
    options?: { days?: number; domainId?: number },
  ) {
    const days = options?.days ?? 30;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const sinceDate = since.toISOString().split("T")[0] as string;

    const rows = await db.dailyEmailUsage.groupBy({
      by: ["date"],
      where: {
        teamId,
        date: { gte: sinceDate },
        ...(options?.domainId ? { domainId: options.domainId } : {}),
      },
      _sum: { delivered: true, hardBounced: true, complained: true },
      orderBy: { date: "asc" },
    });

    return rows.map((row) => {
      const delivered = row._sum.delivered ?? 0;
      const hardBounced = row._sum.hardBounced ?? 0;
      const complained = row._sum.complained ?? 0;
      return {
        date: row.date,
        delivered,
        hardBounced,
        complained,
        bounceRate: rate(hardBounced, delivered + hardBounced),
        complaintRate: rate(complained, delivered + hardBounced),
      };
    });
  }

  static async getEvents(teamId: number, limit = 50) {
    return db.reputationEvent.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  // ----- Acoes de admin. Todas exigem motivo e gravam ator na trilha. -----

  static async adminBlock(teamId: number, actorUserId: number, reason: string) {
    const [state, snapshot] = await Promise.all([
      this.getState(teamId),
      this.computeSnapshot(teamId),
    ]);
    return this.transition(teamId, state.state, ReputationState.BLOCKED, {
      snapshot,
      reason,
      actor: `admin:${actorUserId}`,
      sampleAtBlock: snapshot.sampleSize,
    });
  }

  static async adminUnblock(teamId: number, actorUserId: number, reason: string) {
    const [state, snapshot, policy] = await Promise.all([
      this.getState(teamId),
      this.computeSnapshot(teamId),
      this.getPolicy(teamId),
    ]);
    return this.transition(
      teamId,
      state.state,
      this.classify(snapshot, policy),
      { snapshot, reason, actor: `admin:${actorUserId}` },
    );
  }

  static async adminSupervise(
    teamId: number,
    actorUserId: number,
    reason: string,
    options?: { dailyLimit?: number; days?: number },
  ) {
    const [state, snapshot, policy] = await Promise.all([
      this.getState(teamId),
      this.computeSnapshot(teamId),
      this.getPolicy(teamId),
    ]);
    const until = new Date();
    until.setUTCDate(until.getUTCDate() + (options?.days ?? 7));

    return this.transition(teamId, state.state, ReputationState.SUPERVISED, {
      snapshot,
      reason,
      actor: `admin:${actorUserId}`,
      supervisedUntil: until,
      supervisedLimit: options?.dailyLimit ?? policy.supervisedLimit,
      sampleAtBlock: state.sampleAtBlock ?? snapshot.sampleSize,
    });
  }

  static async adminExempt(
    teamId: number,
    actorUserId: number,
    reason: string,
    days?: number,
  ) {
    const [state, snapshot] = await Promise.all([
      this.getState(teamId),
      this.computeSnapshot(teamId),
    ]);
    let until: Date | null = null;
    if (days) {
      until = new Date();
      until.setUTCDate(until.getUTCDate() + days);
    }
    return this.transition(teamId, state.state, ReputationState.EXEMPT, {
      snapshot,
      reason,
      actor: `admin:${actorUserId}`,
      exemptUntil: until,
    });
  }
}
