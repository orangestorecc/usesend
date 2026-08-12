"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Input } from "@usesend/ui/src/input";
import { GitBranch } from "lucide-react";
import { STEP_META, summarizeStepConfig } from "./step-meta";
import type { AutomationStepType } from "~/server/service/automation-service";

export type TriggerNodeData = {
  triggerEventName: string;
  readOnly: boolean;
  // eslint-disable-next-line no-unused-vars
  onTriggerNameChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars
  onAddStep: (sourceKey: string, condition?: "true" | "false" | "timeout") => void;
};

export function TriggerNode({ data }: NodeProps & { data: TriggerNodeData }) {
  return (
    <div className="w-[260px] rounded-xl border-2 border-yellow bg-yellow/5 p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-yellow mb-2">
        Evento personalizado
      </div>
      <Input
        value={data.triggerEventName}
        placeholder="Nome do evento"
        disabled={data.readOnly}
        onChange={(e) => data.onTriggerNameChange(e.target.value)}
        className="font-mono text-sm"
      />
      <Handle type="source" position={Position.Bottom} id="trigger" />
    </div>
  );
}

export type StepNodeData = {
  stepKey: string;
  type: AutomationStepType;
  config: Record<string, unknown>;
  readOnly: boolean;
  // eslint-disable-next-line no-unused-vars
  onClick: (stepKey: string) => void;
};

export function StepNode({ data }: NodeProps & { data: StepNodeData }) {
  const meta = STEP_META[data.type];
  const Icon = meta.icon;
  const isCondition = data.type === "condition";
  const isWaitForEvent = data.type === "wait_for_event";

  return (
    <div
      className="w-[260px] rounded-xl border border-border bg-card p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => data.onClick(data.stepKey)}
    >
      <Handle type="target" position={Position.Top} id="target" />
      <div className="flex items-center gap-2 mb-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-sm font-medium">{meta.label}</div>
      </div>
      <div className="text-xs text-muted-foreground font-mono truncate">
        {summarizeStepConfig(data.type, data.config)}
      </div>

      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{ left: "30%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{ left: "70%" }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" /> verdadeiro
            </span>
            <span>falso</span>
          </div>
        </>
      ) : isWaitForEvent ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="default"
            style={{ left: "30%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="timeout"
            style={{ left: "70%" }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
            <span>evento</span>
            <span>tempo esgotado</span>
          </div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} id="default" />
      )}
    </div>
  );
}
