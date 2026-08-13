"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Input } from "@usesend/ui/src/input";
import { GitBranch, Zap } from "lucide-react";
import { STEP_META, summarizeStepConfig } from "./step-meta";
import { AddStepMenu } from "./add-step-menu";
import type { AutomationStepType } from "~/server/service/automation-service";

/**
 * Os botões de "+" moram DENTRO dos nós, não numa camada por cima do canvas.
 * A versão anterior posicionava uma sobreposição usando coordenadas do fluxo
 * como se fossem da tela: os botões não acompanhavam zoom nem pan, e ao
 * arrastar um nó ficavam "+" órfãos espalhados. Dentro do nó, o React Flow
 * cuida da transformação e tudo se move junto.
 */

export type TriggerNodeData = {
  triggerEventName: string;
  readOnly: boolean;
  // eslint-disable-next-line no-unused-vars
  onTriggerNameChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars
  onAddStep: (
    sourceKey: string,
    type: AutomationStepType,
    condition?: "true" | "false" | "timeout",
  ) => void;
  stepKey: string;
};

export function TriggerNode({ data }: NodeProps & { data: TriggerNodeData }) {
  return (
    <div className="w-[280px]">
      <div className="rounded-xl border-2 border-yellow bg-card p-4 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow/15 text-yellow">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-yellow">
              Gatilho
            </div>
          </div>
        </div>
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          A automação começa quando este evento chega pela API ou por uma
          integração.
        </p>
        {/* `nodrag`: sem isso o clique no campo vira arrasto do nó e o cursor
            nunca entra — parecia que o texto digitado não aparecia. */}
        <Input
          value={data.triggerEventName}
          placeholder="ex.: pedido_pago"
          disabled={data.readOnly}
          onChange={(e) => data.onTriggerNameChange(e.target.value)}
          className="nodrag font-mono text-sm"
        />
        {/* id "default" para casar com as arestas, que sempre saem por
            "default" quando não há condição. Com id "trigger", a ligação era
            criada e o React Flow a descartava em silêncio: o gatilho nunca
            aparecia conectado a nada. */}
        <Handle type="source" position={Position.Bottom} id="default" />
      </div>

      {!data.readOnly ? (
        <div className="mt-3 flex justify-center">
          <AddStepMenu
            onSelect={(type) => data.onAddStep(data.stepKey, type)}
            label="Adicionar a primeira etapa"
          />
        </div>
      ) : null}
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
  // eslint-disable-next-line no-unused-vars
  onAddStep: (
    sourceKey: string,
    type: AutomationStepType,
    condition?: "true" | "false" | "timeout",
  ) => void;
};

export function StepNode({ data }: NodeProps & { data: StepNodeData }) {
  const meta = STEP_META[data.type];
  const Icon = meta.icon;
  const isCondition = data.type === "condition";
  const isWaitForEvent = data.type === "wait_for_event";
  const doisRamos = isCondition || isWaitForEvent;

  return (
    <div className="w-[280px]">
      <div
        className="cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        onClick={() => data.onClick(data.stepKey)}
      >
        <Handle type="target" position={Position.Top} id="target" />
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-sm font-medium">{meta.label}</div>
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground">
          {summarizeStepConfig(data.type, data.config)}
        </div>

        {isCondition ? (
          <>
            <Handle
              type="source"
              position={Position.Bottom}
              id="true"
              style={{ left: "25%" }}
            />
            <Handle
              type="source"
              position={Position.Bottom}
              id="false"
              style={{ left: "75%" }}
            />
            <div className="mt-2 flex justify-between px-1 text-[10px] text-muted-foreground">
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
              style={{ left: "25%" }}
            />
            <Handle
              type="source"
              position={Position.Bottom}
              id="timeout"
              style={{ left: "75%" }}
            />
            <div className="mt-2 flex justify-between px-1 text-[10px] text-muted-foreground">
              <span>evento</span>
              <span>tempo esgotado</span>
            </div>
          </>
        ) : (
          <Handle type="source" position={Position.Bottom} id="default" />
        )}
      </div>

      {!data.readOnly ? (
        doisRamos ? (
          <div className="mt-3 flex justify-between px-6">
            <AddStepMenu
              onSelect={(type) =>
                data.onAddStep(
                  data.stepKey,
                  type,
                  isCondition ? "true" : undefined,
                )
              }
              label={isCondition ? "Adicionar no ramo verdadeiro" : "Adicionar após o evento"}
            />
            <AddStepMenu
              onSelect={(type) =>
                data.onAddStep(
                  data.stepKey,
                  type,
                  isCondition ? "false" : "timeout",
                )
              }
              label={isCondition ? "Adicionar no ramo falso" : "Adicionar no tempo esgotado"}
            />
          </div>
        ) : (
          <div className="mt-3 flex justify-center">
            <AddStepMenu
              onSelect={(type) => data.onAddStep(data.stepKey, type)}
              label="Adicionar etapa"
            />
          </div>
        )
      ) : null}
    </div>
  );
}
