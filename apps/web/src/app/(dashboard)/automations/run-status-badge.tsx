import { AutomationRunStatus } from "@prisma/client";

interface RunStatusBadgeProps {
  status: AutomationRunStatus;
}

export default function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const getStatusLabel = (status: AutomationRunStatus) => {
    switch (status) {
      case AutomationRunStatus.RUNNING:
        return "Em execução";
      case AutomationRunStatus.WAITING:
        return "Aguardando";
      case AutomationRunStatus.COMPLETED:
        return "Concluída";
      case AutomationRunStatus.FAILED:
        return "Falhou";
      case AutomationRunStatus.CANCELLED:
        return "Cancelada";
      default:
        return status;
    }
  };

  const getStatusColor = (status: AutomationRunStatus) => {
    switch (status) {
      case AutomationRunStatus.RUNNING:
        return "bg-blue/15 text-blue border border-blue/20";
      case AutomationRunStatus.WAITING:
        return "bg-yellow/15 text-yellow border border-yellow/20";
      case AutomationRunStatus.COMPLETED:
        return "bg-green/15 text-green border border-green/20";
      case AutomationRunStatus.FAILED:
        return "bg-red/15 text-red border border-red/20";
      case AutomationRunStatus.CANCELLED:
        return "bg-gray/15 text-gray border border-gray/20";
      default:
        return "bg-gray/15 text-gray border border-gray/20";
    }
  };

  return (
    <div
      className={`text-center min-w-[110px] rounded capitalize py-1 px-3 text-xs ${getStatusColor(
        status,
      )}`}
    >
      {getStatusLabel(status)}
    </div>
  );
}
