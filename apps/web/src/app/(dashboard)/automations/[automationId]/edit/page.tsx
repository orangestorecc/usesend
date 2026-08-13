"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { AutomationStatus } from "@prisma/client";
import { api } from "~/trpc/react";
import { toast } from "@usesend/ui/src/toaster";
import { Button } from "@usesend/ui/src/button";
import Spinner from "@usesend/ui/src/spinner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@usesend/ui/src/breadcrumb";
import type {
  AutomationConnection,
  AutomationSteps,
  AutomationStepType,
} from "~/server/service/automation-service";

import { TriggerNode, StepNode, type TriggerNodeData, type StepNodeData } from "./nodes";
import { AddStepMenu } from "./add-step-menu";
import { ConfigPanel } from "./config-panel";
import AutomationStatusBadge from "../../automation-status-badge";
import DuplicateAutomation from "../../duplicate-automation";

const V_SPACING = 170;
const H_SPACING = 300;

const nodeTypes: NodeTypes = {
  trigger: TriggerNode as unknown as NodeTypes["trigger"],
  step: StepNode as unknown as NodeTypes["step"],
};

function defaultConfigFor(type: AutomationStepType): Record<string, unknown> {
  switch (type) {
    case "send_email":
      return { subject: "", from: "", html: "" };
    case "condition":
      return { rules: { match: "all", conditions: [] } };
    case "delay":
      return { durationMs: 5 * 60000 };
    case "wait_for_event":
      return { eventName: "" };
    case "update_contact":
      return { properties: {} };
    case "delete_contact":
      return {};
    case "add_to_segment":
      return { segmentId: "" };
    default:
      return {};
  }
}

function layoutFromStepsAndConnections(
  steps: AutomationSteps,
  connections: AutomationConnection[],
): { nodes: Node[]; edges: Edge[] } {
  const triggerKey =
    Object.entries(steps).find(([, step]) => step.type === "trigger")?.[0] ??
    "trigger";

  const childrenByParent = new Map<string, AutomationConnection[]>();
  connections.forEach((c) => {
    const list = childrenByParent.get(c.from) ?? [];
    list.push(c);
    childrenByParent.set(c.from, list);
  });

  const depth = new Map<string, number>();
  const order: string[] = [];
  const queue: string[] = [triggerKey];
  depth.set(triggerKey, 0);
  const visited = new Set<string>([triggerKey]);

  while (queue.length) {
    const key = queue.shift() as string;
    order.push(key);
    const children = childrenByParent.get(key) ?? [];
    children.forEach((c) => {
      if (!visited.has(c.to)) {
        visited.add(c.to);
        depth.set(c.to, (depth.get(key) ?? 0) + 1);
        queue.push(c.to);
      }
    });
  }

  // Any orphan steps (not reachable from trigger) still need to render.
  Object.keys(steps).forEach((key) => {
    if (!visited.has(key)) {
      order.push(key);
      depth.set(key, 0);
      visited.add(key);
    }
  });

  const countAtDepth = new Map<number, number>();
  const nodes: Node[] = order.map((key) => {
    const d = depth.get(key) ?? 0;
    const indexAtDepth = countAtDepth.get(d) ?? 0;
    countAtDepth.set(d, indexAtDepth + 1);

    const step = steps[key];
    const type = step?.type ?? "send_email";

    return {
      id: key,
      type: type === "trigger" ? "trigger" : "step",
      position: { x: indexAtDepth * H_SPACING, y: d * V_SPACING },
      data:
        type === "trigger"
          ? ({} as TriggerNodeData)
          : ({
              stepKey: key,
              type,
              config: step?.config ?? {},
            } as unknown as StepNodeData),
      draggable: true,
    } satisfies Node;
  });

  const edges: Edge[] = connections.map((c, i) => ({
    id: `e-${c.from}-${c.to}-${i}`,
    source: c.from,
    target: c.to,
    sourceHandle: c.condition ?? "default",
    data: { condition: c.condition },
    label: c.condition === "true" ? "verdadeiro" : c.condition === "false" ? "falso" : c.condition === "timeout" ? "tempo esgotado" : undefined,
  }));

  return { nodes, edges };
}

let stepCounter = 0;
function generateStepKey() {
  stepCounter += 1;
  return `step_${Date.now()}_${stepCounter}`;
}

export default function AutomationEditPage({
  params,
}: {
  params: Promise<{ automationId: string }>;
}) {
  const { automationId } = use(params);
  const router = useRouter();

  const { data: automation, isLoading } = api.automation.get.useQuery({
    id: automationId,
  });

  const updateMutation = api.automation.update.useMutation();
  const enableMutation = api.automation.enable.useMutation();
  const utils = api.useUtils();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [triggerEventName, setTriggerEventName] = useState("");
  const [configStepKey, setConfigStepKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const readOnly = automation?.status === AutomationStatus.ENABLED;

  useEffect(() => {
    if (!automation || hydrated) return;

    const steps = (automation.steps ?? {}) as unknown as AutomationSteps;
    const connections = (automation.connections ??
      []) as unknown as AutomationConnection[];

    const { nodes: initialNodes, edges: initialEdges } =
      layoutFromStepsAndConnections(steps, connections);

    setNodes(initialNodes);
    setEdges(initialEdges);
    setTriggerEventName(automation.triggerEventName);
    setHydrated(true);
  }, [automation, hydrated]);

  const stepsMap = useMemo(() => {
    const map = new Map<string, { type: AutomationStepType; config: Record<string, unknown> }>();
    nodes.forEach((n) => {
      if (n.type === "trigger") {
        map.set(n.id, { type: "trigger", config: {} });
      } else {
        const data = n.data as unknown as StepNodeData;
        map.set(n.id, { type: data.type, config: data.config });
      }
    });
    return map;
  }, [nodes]);

  const addStep = useCallback(
    (
      sourceKey: string,
      type: AutomationStepType,
      condition?: "true" | "false" | "timeout",
    ) => {
      const sourceNode = nodes.find((n) => n.id === sourceKey);
      if (!sourceNode) return;

      const newKey = generateStepKey();
      const siblingsAtDepth = nodes.filter(
        (n) => n.position.y === sourceNode.position.y + V_SPACING,
      ).length;

      const newNode: Node = {
        id: newKey,
        type: "step",
        position: {
          x: sourceNode.position.x + siblingsAtDepth * H_SPACING,
          y: sourceNode.position.y + V_SPACING,
        },
        data: {
          stepKey: newKey,
          type,
          config: defaultConfigFor(type),
        } as unknown as StepNodeData,
        draggable: true,
      };

      const newEdge: Edge = {
        id: `e-${sourceKey}-${newKey}`,
        source: sourceKey,
        target: newKey,
        sourceHandle: condition ?? "default",
        data: { condition },
        label:
          condition === "true"
            ? "verdadeiro"
            : condition === "false"
              ? "falso"
              : condition === "timeout"
                ? "tempo esgotado"
                : undefined,
      };

      setNodes((prev) => [...prev, newNode]);
      setEdges((prev) => [...prev, newEdge]);
    },
    [nodes],
  );

  const nodesWithHandlers: Node[] = useMemo(
    () =>
      nodes.map((n) => {
        if (n.type === "trigger") {
          return {
            ...n,
            data: {
              triggerEventName,
              readOnly,
              onTriggerNameChange: setTriggerEventName,
              onAddStep: addStep,
              stepKey: n.id,
            } as TriggerNodeData,
          };
        }
        const data = n.data as unknown as StepNodeData;
        return {
          ...n,
          data: {
            ...data,
            readOnly,
            onClick: (key: string) => setConfigStepKey(key),
            onAddStep: addStep,
          } as StepNodeData,
        };
      }),
    [nodes, triggerEventName, readOnly, addStep],
  );

  const handleSave = useCallback(() => {
    if (readOnly) return;

    const steps: AutomationSteps = {};
    stepsMap.forEach((value, key) => {
      steps[key] = { type: value.type, config: value.config };
    });

    const connections: AutomationConnection[] = edges.map((e) => ({
      from: e.source,
      to: e.target,
      condition: (e.data?.condition as "true" | "false" | "timeout" | undefined) ?? undefined,
    }));

    updateMutation.mutate(
      {
        id: automationId,
        triggerEventName,
        steps,
        connections,
      },
      {
        onSuccess: () => {
          toast.success("Automação salva");
          utils.automation.get.invalidate({ id: automationId });
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  }, [readOnly, stepsMap, edges, updateMutation, automationId, triggerEventName, utils]);

  const handlePublish = useCallback(() => {
    enableMutation.mutate(
      { id: automationId },
      {
        onSuccess: () => {
          toast.success("Automação ativada");
          utils.automation.get.invalidate({ id: automationId });
          utils.automation.list.invalidate();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  }, [enableMutation, automationId, utils]);

  const configStep = configStepKey ? stepsMap.get(configStepKey) : null;

  const handleConfigSave = useCallback(
    (config: Record<string, unknown>) => {
      if (!configStepKey) return;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === configStepKey
            ? { ...n, data: { ...(n.data as object), config } }
            : n,
        ),
      );
      setConfigStepKey(null);
      toast.success("Etapa atualizada. Não esqueça de salvar a automação.");
    },
    [configStepKey],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="w-5 h-5 text-foreground" />
      </div>
    );
  }

  if (!automation) {
    return <div>Automação não encontrada</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center pb-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/automations" className="text-lg">
                  Automações
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-lg" />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-lg">
                <div className="flex items-center gap-2">
                  <div className="max-w-[300px] truncate">
                    {automation.name}
                  </div>
                  <AutomationStatusBadge status={automation.status} />
                </div>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-3">
          {!readOnly && (
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          )}
          {!readOnly && (
            <Button onClick={handlePublish} disabled={enableMutation.isPending}>
              {enableMutation.isPending ? "Publicando..." : "Publicar"}
            </Button>
          )}
          {readOnly && (
            <Button variant="outline" onClick={() => router.push(`/automations/${automation.id}`)}>
              Ver automação
            </Button>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-yellow/30 bg-yellow/10 px-4 py-3 text-sm">
          <span>
            Esta automação está ativa. Duplique para fazer alterações.
          </span>
          <DuplicateAutomation
            automation={automation}
            onDuplicated={(newId) => router.push(`/automations/${newId}/edit`)}
            trigger={<Button size="sm">Duplicar para editar</Button>}
          />
        </div>
      )}

      {/* fitViewOptions com teto de zoom: sem ele, o fitView aproxima demais
          quando há poucos nós e o palco abre gigante. */}
      <div className="relative flex-1 min-h-[600px] rounded-xl border border-border overflow-hidden">
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) =>
            setNodes((prev) => applyPositionChanges(prev, changes))
          }
          nodesDraggable={!readOnly}
          nodesConnectable={false}
          elementsSelectable={!readOnly}
          fitView
          fitViewOptions={{ padding: 0.4, maxZoom: 0.9 }}
          minZoom={0.3}
          className="[&_.react-flow__attribution]:!bg-transparent [&_.react-flow__attribution_a]:!text-muted-foreground/60 [&_.react-flow__attribution_a]:text-[10px]"
        >
          <Background />
          {/* Os controles do React Flow vêm com fundo branco fixo — no tema
              escuro viravam um bloco branco. As classes forçam as cores do
              tema. */}
          <Controls
            showInteractive={false}
            className="[&>button]:!border-border [&>button]:!bg-card [&>button:hover]:!bg-accent [&>button>svg]:!fill-foreground !shadow-none !border !border-border !rounded-lg overflow-hidden"
          />
        </ReactFlow>

      </div>

      <ConfigPanel
        open={!!configStepKey}
        onOpenChange={(open) => !open && setConfigStepKey(null)}
        stepType={configStep?.type ?? null}
        config={configStep?.config ?? {}}
        readOnly={readOnly}
        onSave={handleConfigSave}
      />
    </div>
  );
}

// Minimal position-change reducer so dragging nodes updates local state
// without pulling in the full @xyflow/react changes helper surface.
function applyPositionChanges(nodes: Node[], changes: unknown[]): Node[] {
  let next = nodes;
  for (const change of changes as Array<{
    type: string;
    id?: string;
    position?: { x: number; y: number };
  }>) {
    if (change.type === "position" && change.id && change.position) {
      next = next.map((n) =>
        n.id === change.id ? { ...n, position: change.position! } : n,
      );
    }
  }
  return next;
}
