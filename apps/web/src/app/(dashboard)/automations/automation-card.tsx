"use client";

import { AutomationStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@usesend/ui/src/tooltip";
import DeleteAutomation from "./delete-automation";
import DuplicateAutomation from "./duplicate-automation";
import ToggleAutomation from "./toggle-automation";
import AutomationStatusBadge from "./automation-status-badge";

interface AutomationCardProps {
  automation: {
    id: string;
    name: string;
    status: AutomationStatus;
    triggerEventName: string;
    updatedAt: Date;
    _count: { runs: number };
  };
}

export default function AutomationCard({ automation }: AutomationCardProps) {
  return (
    <div className="border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="w-1/3">
          <Link href={`/automations/${automation.id}`}>
            <div className="text-ellipsis text-sm font-medium underline decoration-dashed underline-offset-2">
              {automation.name}
            </div>
          </Link>

          <div className="text-sm font-mono text-muted-foreground mt-2">
            <div className="flex items-center gap-2">
              <span>
                Gatilho <strong>{automation.triggerEventName}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground font-mono">
          {automation._count.runs} execuções
        </div>

        <AutomationStatusBadge status={automation.status} />

        <div className="text-xs text-muted-foreground font-mono w-[110px] text-right">
          Atualizada{" "}
          {formatDistanceToNow(new Date(automation.updatedAt), {
            addSuffix: true,
          })}
        </div>

        <TooltipProvider>
          <div className="flex gap-4 items-center justify-end w-[150px]">
            {automation.status !== AutomationStatus.DRAFT && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <ToggleAutomation automation={automation} />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {automation.status === AutomationStatus.ENABLED
                    ? "Desativar automação"
                    : "Ativar automação"}
                </TooltipContent>
              </Tooltip>
            )}
            {automation.status === AutomationStatus.DRAFT && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={`/automations/${automation.id}/edit`}
                    className="text-xs underline decoration-dashed underline-offset-2"
                  >
                    Editar
                  </Link>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Editar automação
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <DuplicateAutomation automation={automation} />
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Duplicar automação
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <DeleteAutomation automation={automation} />
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Excluir automação
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
