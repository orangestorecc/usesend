import {
  Mail,
  GitBranch,
  Clock,
  Hourglass,
  UserPen,
  UserX,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AutomationStepType } from "~/server/service/automation-service";

export const STEP_META: Record<
  AutomationStepType,
  { label: string; icon: LucideIcon }
> = {
  trigger: { label: "Gatilho", icon: Zap },
  send_email: { label: "Enviar e-mail", icon: Mail },
  condition: { label: "Condição", icon: GitBranch },
  delay: { label: "Aguardar", icon: Clock },
  wait_for_event: { label: "Aguardar evento", icon: Hourglass },
  update_contact: { label: "Atualizar contato", icon: UserPen },
  delete_contact: { label: "Excluir contato", icon: UserX },
  add_to_segment: { label: "Adicionar ao segmento", icon: Users },
};

export function summarizeStepConfig(
  type: AutomationStepType,
  config: Record<string, unknown>,
): string {
  switch (type) {
    case "send_email": {
      const subject = (config.subject as string) ?? "";
      return subject ? `Assunto: ${subject}` : "Sem assunto definido";
    }
    case "condition": {
      const rules = (config.rules as { conditions?: unknown[] } | undefined)
        ?.conditions;
      const count = rules?.length ?? 0;
      return count === 1 ? "1 regra" : `${count} regras`;
    }
    case "delay": {
      const ms = (config.durationMs as number) ?? 0;
      return formatDuration(ms);
    }
    case "wait_for_event": {
      const eventName = (config.eventName as string) ?? "";
      return eventName ? `Evento: ${eventName}` : "Nenhum evento definido";
    }
    case "update_contact": {
      const properties =
        (config.properties as Record<string, unknown>) ?? {};
      const count = Object.keys(properties).length;
      return count === 1 ? "1 propriedade" : `${count} propriedades`;
    }
    case "delete_contact":
      return "Exclui o contato";
    case "add_to_segment": {
      const segmentId = (config.segmentId as string) ?? "";
      return segmentId ? `Segmento: ${segmentId}` : "Nenhum segmento definido";
    }
    default:
      return "";
  }
}

export function formatDuration(ms: number): string {
  if (!ms) return "0 minutos";
  const minutes = ms / 60000;
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} ${days === 1 ? "dia" : "dias"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

export function msToValueUnit(ms: number | undefined): {
  value: number;
  unit: "minutes" | "hours" | "days";
} {
  if (!ms) return { value: 5, unit: "minutes" };
  if (ms % (24 * 60 * 60 * 1000) === 0) {
    return { value: ms / (24 * 60 * 60 * 1000), unit: "days" };
  }
  if (ms % (60 * 60 * 1000) === 0) {
    return { value: ms / (60 * 60 * 1000), unit: "hours" };
  }
  return { value: Math.round(ms / 60000), unit: "minutes" };
}

export function valueUnitToMs(
  value: number,
  unit: "minutes" | "hours" | "days",
): number {
  const multiplier =
    unit === "minutes" ? 60000 : unit === "hours" ? 3600000 : 86400000;
  return value * multiplier;
}
