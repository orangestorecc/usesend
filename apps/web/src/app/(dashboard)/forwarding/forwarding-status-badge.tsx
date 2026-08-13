import { ForwardingRuleStatus } from "@prisma/client";

export function ForwardingStatusBadge({
  status,
}: {
  status: ForwardingRuleStatus;
}) {
  let badgeColor = "bg-gray-700/10 text-gray-400 border border-gray-400/10";
  let label: string = status;

  if (status === ForwardingRuleStatus.ACTIVE) {
    badgeColor = "bg-green/15 text-green border border-green/20";
    label = "Ativa";
  } else if (status === ForwardingRuleStatus.PENDING_VERIFICATION) {
    badgeColor = "bg-yellow/15 text-yellow border border-yellow/20";
    label = "Aguardando confirmação";
  } else if (status === ForwardingRuleStatus.PAUSED) {
    badgeColor = "bg-yellow/15 text-yellow border border-yellow/20";
    label = "Pausada";
  } else if (status === ForwardingRuleStatus.DISABLED_BOUNCED) {
    badgeColor = "bg-red/15 text-red border border-red/20";
    label = "Bloqueada por falhas";
  }

  return (
    <div
      className={`w-[180px] rounded py-1 text-center text-xs ${badgeColor}`}
    >
      {label}
    </div>
  );
}
