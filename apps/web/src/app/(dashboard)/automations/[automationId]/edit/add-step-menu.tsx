"use client";

import { Button } from "@usesend/ui/src/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@usesend/ui/src/popover";
import { Plus, Sparkles } from "lucide-react";
import { STEP_META } from "./step-meta";
import type { AutomationStepType } from "~/server/service/automation-service";

const MESSAGE_STEPS: AutomationStepType[] = ["send_email"];
const FLOW_CONTROL_STEPS: AutomationStepType[] = [
  "condition",
  "delay",
  "wait_for_event",
];
const AUDIENCE_STEPS: AutomationStepType[] = [
  "update_contact",
  "delete_contact",
  "add_to_segment",
];

export function AddStepMenu({
  onSelect,
  label,
}: {
  // eslint-disable-next-line no-unused-vars
  onSelect: (type: AutomationStepType) => void;
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full h-7 w-7 p-0 border-dashed"
          title={label ?? "Adicionar etapa"}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="center">
        <div className="flex flex-col">
          <button
            type="button"
            disabled
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground cursor-not-allowed"
          >
            <Sparkles className="h-4 w-4" />
            Criar com IA...
            <span className="ml-auto text-[10px] rounded bg-muted px-1.5 py-0.5">
              Em breve
            </span>
          </button>

          <StepGroup
            title="Mensagens"
            steps={MESSAGE_STEPS}
            onSelect={onSelect}
          />
          <StepGroup
            title="Controle de fluxo"
            steps={FLOW_CONTROL_STEPS}
            onSelect={onSelect}
          />
          <StepGroup
            title="Audiência"
            steps={AUDIENCE_STEPS}
            onSelect={onSelect}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StepGroup({
  title,
  steps,
  onSelect,
}: {
  title: string;
  steps: AutomationStepType[];
  // eslint-disable-next-line no-unused-vars
  onSelect: (type: AutomationStepType) => void;
}) {
  return (
    <div className="mt-2">
      <div className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {steps.map((type) => {
        const meta = STEP_META[type];
        const Icon = meta.icon;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
          >
            <Icon className="h-4 w-4" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
