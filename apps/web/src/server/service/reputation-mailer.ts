import { ReputationState } from "@prisma/client";
import { env } from "~/env";
import { logger } from "../logger/log";
import { sendMail } from "../mailer";
import { getRedis, redisKey } from "../redis";
import {
  renderReputationEmail,
  type ReputationEmailKind,
} from "../email-templates/ReputationEmail";
import { sendToDiscord } from "./notification-service";
import { ReputationService, type ReputationSnapshot } from "./reputation-service";
import { TeamService } from "./team-service";

/**
 * Régua de e-mails do controle de bounce (docs-spec/BOUNCE-CONTROL-SPEC.md §5).
 * Cooldown atômico em Redis (SET NX), mesmo padrão dos avisos de limite.
 */

const COOLDOWN_SECONDS: Record<ReputationEmailKind, number> = {
  warning: 72 * 60 * 60,
  critical: 24 * 60 * 60,
  blocked: 0, // 1x por bloqueio; a chave é limpa ao desbloquear
  blocked_reminder: 72 * 60 * 60,
  supervised: 0,
  recovered: 0,
};

const SUBJECTS: Record<ReputationEmailKind, string> = {
  warning: "Madmail: sua taxa de retorno subiu um pouco",
  critical: "Madmail: sua taxa de retorno está perto do limite",
  blocked: "Madmail: seus envios foram pausados — veja como retomar",
  blocked_reminder: "Madmail: ainda podemos te ajudar a voltar a enviar",
  supervised: "Madmail: seus envios foram liberados em modo assistido",
  recovered: "Madmail: sua taxa de retorno voltou ao normal",
};

const MAX_BLOCKED_REMINDERS = 3;

export class ReputationMailer {
  static async onTransition(params: {
    teamId: number;
    from: ReputationState;
    to: ReputationState;
    snapshot: ReputationSnapshot;
    reason?: string;
  }) {
    const { teamId, from, to, snapshot, reason } = params;

    const kind = this.kindForTransition(from, to);

    if (to !== ReputationState.BLOCKED) {
      // Novo ciclo: o e-mail de bloqueio e os lembretes voltam a poder disparar.
      await this.clearCooldowns(teamId);
    }

    if (to === ReputationState.BLOCKED || from === ReputationState.BLOCKED) {
      await this.notifyInternal({ teamId, from, to, snapshot, reason });
    }

    if (!kind) return;
    await this.send(teamId, kind, snapshot);
  }

  private static kindForTransition(
    from: ReputationState,
    to: ReputationState,
  ): ReputationEmailKind | null {
    if (to === ReputationState.BLOCKED) return "blocked";
    if (to === ReputationState.SUPERVISED) return "supervised";
    if (to === ReputationState.CRITICAL) return "critical";
    if (to === ReputationState.WARNING) {
      // Subiu para WARNING é aviso; cair de CRITICAL para WARNING é melhora,
      // e nesse caso o cliente já viu o alerta — não repetimos o susto.
      return from === ReputationState.HEALTHY ? "warning" : null;
    }
    if (to === ReputationState.HEALTHY) {
      return from === ReputationState.HEALTHY ? null : "recovered";
    }
    return null;
  }

  /** Lembrete periódico enquanto o time segue bloqueado (máx. 3). */
  static async maybeSendBlockedReminder(teamId: number) {
    const redis = getRedis();
    const countKey = redisKey(`reputation:mail:reminders:${teamId}`);
    const sent = Number((await redis.get(countKey)) ?? 0);
    if (sent >= MAX_BLOCKED_REMINDERS) return;

    const snapshot = await ReputationService.getSnapshotCached(teamId);
    const delivered = await this.send(teamId, "blocked_reminder", snapshot);
    if (delivered) {
      await redis.incr(countKey);
      await redis.expire(countKey, 60 * 24 * 60 * 60);
    }
  }

  private static async send(
    teamId: number,
    kind: ReputationEmailKind,
    snapshot: ReputationSnapshot,
  ): Promise<boolean> {
    const cooldown = COOLDOWN_SECONDS[kind];
    const key = redisKey(`reputation:mail:${teamId}:${kind}`);

    try {
      const redis = getRedis();
      const acquired = await redis.set(
        key,
        "1",
        "EX",
        cooldown > 0 ? cooldown : 30 * 24 * 60 * 60,
        "NX",
      );
      if (acquired !== "OK") {
        logger.info(
          { teamId, kind },
          "[ReputationMailer]: cooldown ativo, e-mail nao enviado",
        );
        return false;
      }
    } catch (err) {
      // Sem Redis não há como garantir o cooldown. Preferimos não enviar a
      // arriscar disparar o mesmo alerta em loop para o cliente.
      logger.error(
        { err, teamId, kind },
        "[ReputationMailer]: Redis indisponivel, e-mail nao enviado",
      );
      return false;
    }

    const team = await TeamService.getTeamCached(teamId);
    const [state, policy] = await Promise.all([
      ReputationService.getState(teamId),
      ReputationService.getPolicy(teamId),
    ]);

    const reputationUrl = `${env.NEXTAUTH_URL}/reputation`;
    const supportUrl = `${env.NEXTAUTH_URL}/support`;

    const html = await renderReputationEmail({
      kind,
      teamName: team.name,
      bounceRate: snapshot.bounceRate,
      blockRate: policy.blockRate,
      sampleSize: snapshot.sampleSize,
      supervisedLimit: state.supervisedLimit ?? policy.supervisedLimit,
      supervisedUntil: state.supervisedUntil
        ? state.supervisedUntil.toLocaleDateString("pt-BR")
        : undefined,
      reputationUrl,
      supportUrl,
    });

    const text = this.plainText(kind, {
      teamName: team.name,
      bounceRate: snapshot.bounceRate,
      blockRate: policy.blockRate,
      reputationUrl,
    });

    const teamUsers = await TeamService.getTeamUsers(teamId);
    const recipients = teamUsers
      .map((tu) => tu.user?.email)
      .filter((e): e is string => Boolean(e));

    if (recipients.length === 0) {
      logger.warn({ teamId, kind }, "[ReputationMailer]: time sem destinatarios");
      return false;
    }

    try {
      await Promise.all(
        recipients.map((to) =>
          sendMail(to, SUBJECTS[kind], text, html, "suporte@madmail.com.br"),
        ),
      );
      logger.info(
        { teamId, kind, recipients: recipients.length },
        "[ReputationMailer]: aviso de reputacao enviado",
      );
      return true;
    } catch (err) {
      logger.error({ err, teamId, kind }, "[ReputationMailer]: falha ao enviar");
      return false;
    }
  }

  private static plainText(
    kind: ReputationEmailKind,
    data: {
      teamName: string;
      bounceRate: number;
      blockRate: number;
      reputationUrl: string;
    },
  ): string {
    const rate = data.bounceRate.toFixed(2);
    const head = `Olá, time ${data.teamName},\n\n`;
    const tail = `\n\nDetalhes e plano de ação: ${data.reputationUrl}\n\nSeu acesso ao painel, contatos e relatórios continua liberado.`;

    const bodies: Record<ReputationEmailKind, string> = {
      warning: `A sua taxa de retorno está em ${rate}%, um pouco acima do saudável. Nada está pausado — é um aviso cedo, enquanto é fácil resolver.`,
      critical: `A sua taxa de retorno chegou a ${rate}%. O limite para pausa automática de envios é ${data.blockRate}%. Ainda dá tempo de reverter.`,
      blocked: `A sua taxa de retorno chegou a ${rate}%, acima do limite de ${data.blockRate}%. Pausamos os novos envios para proteger a entregabilidade da sua conta. Campanhas em andamento foram pausadas e retomam do ponto certo — nada foi perdido.`,
      blocked_reminder: `Os seus envios seguem pausados, com taxa de retorno em ${rate}%. Se quiser ajuda para ajustar a lista, responda este e-mail.`,
      supervised: `Os seus envios foram liberados em modo assistido, com limite diário reduzido. Se a taxa voltar a passar de ${data.blockRate}%, os envios são pausados de novo.`,
      recovered: `A sua taxa de retorno está em ${rate}%, de volta à faixa saudável. Os envios seguem liberados normalmente.`,
    };

    return head + bodies[kind] + tail;
  }

  private static async clearCooldowns(teamId: number) {
    try {
      const redis = getRedis();
      await redis.del(
        redisKey(`reputation:mail:${teamId}:blocked`),
        redisKey(`reputation:mail:${teamId}:blocked_reminder`),
        redisKey(`reputation:mail:reminders:${teamId}`),
      );
    } catch {
      // cooldowns expiram sozinhos
    }
  }

  /** Alerta interno no Discord: todo bloqueio e todo desbloqueio. */
  private static async notifyInternal(params: {
    teamId: number;
    from: ReputationState;
    to: ReputationState;
    snapshot: ReputationSnapshot;
    reason?: string;
  }) {
    const { teamId, from, to, snapshot, reason } = params;
    try {
      const team = await TeamService.getTeamCached(teamId);
      const emoji = to === ReputationState.BLOCKED ? "🚫" : "✅";
      await sendToDiscord(
        `${emoji} **Reputação** — time **${team.name}** (#${teamId}): ${from} → ${to}\n` +
          `Taxa de retorno: ${snapshot.bounceRate.toFixed(2)}% em ${snapshot.sampleSize.toLocaleString("pt-BR")} entregas` +
          (reason ? `\nMotivo: ${reason}` : "") +
          `\n${env.NEXTAUTH_URL}/admin/reputation/${teamId}`,
      );
    } catch (err) {
      logger.warn({ err, teamId }, "[ReputationMailer]: falha ao avisar no Discord");
    }
  }
}
