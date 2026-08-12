import { AutomationStatus } from "@prisma/client";

interface AutomationStatusBadgeProps {
  status: AutomationStatus;
}

export default function AutomationStatusBadge({
  status,
}: AutomationStatusBadgeProps) {
  const getStatusLabel = (status: AutomationStatus) => {
    switch (status) {
      case AutomationStatus.DRAFT:
        return "Rascunho";
      case AutomationStatus.ENABLED:
        return "Ativa";
      case AutomationStatus.DISABLED:
        return "Desativada";
      default:
        return status;
    }
  };

  const getStatusColor = (status: AutomationStatus) => {
    switch (status) {
      case AutomationStatus.DRAFT:
        return "bg-gray/15 text-gray border border-gray/20";
      case AutomationStatus.ENABLED:
        return "bg-green/15 text-green border border-green/20";
      case AutomationStatus.DISABLED:
        return "bg-yellow/15 text-yellow border border-yellow/20";
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
