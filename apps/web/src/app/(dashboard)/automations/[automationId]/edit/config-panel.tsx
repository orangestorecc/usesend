"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@usesend/ui/src/sheet";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { Textarea } from "@usesend/ui/src/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@usesend/ui/src/select";
import { Plus, Trash2 } from "lucide-react";
import type { AutomationStepType } from "~/server/service/automation-service";
import { STEP_META, msToValueUnit, valueUnitToMs } from "./step-meta";

type Condition = { field: string; op: string; value: string };

export function ConfigPanel({
  open,
  onOpenChange,
  stepType,
  config,
  readOnly,
  onSave,
}: {
  open: boolean;
  // eslint-disable-next-line no-unused-vars
  onOpenChange: (open: boolean) => void;
  stepType: AutomationStepType | null;
  config: Record<string, unknown>;
  readOnly: boolean;
  // eslint-disable-next-line no-unused-vars
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [local, setLocal] = useState<Record<string, unknown>>(config);

  useEffect(() => {
    setLocal(config);
  }, [config, stepType]);

  if (!stepType) return null;

  const meta = STEP_META[stepType];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{meta.label}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {stepType === "send_email" && (
            <SendEmailForm local={local} setLocal={setLocal} readOnly={readOnly} />
          )}
          {stepType === "condition" && (
            <ConditionForm local={local} setLocal={setLocal} readOnly={readOnly} />
          )}
          {stepType === "delay" && (
            <DelayForm local={local} setLocal={setLocal} readOnly={readOnly} />
          )}
          {stepType === "wait_for_event" && (
            <WaitForEventForm
              local={local}
              setLocal={setLocal}
              readOnly={readOnly}
            />
          )}
          {stepType === "update_contact" && (
            <UpdateContactForm
              local={local}
              setLocal={setLocal}
              readOnly={readOnly}
            />
          )}
          {stepType === "delete_contact" && (
            <p className="text-sm text-muted-foreground">
              Esta etapa exclui o contato. Nenhuma configuração necessária.
            </p>
          )}
          {stepType === "add_to_segment" && (
            <AddToSegmentForm
              local={local}
              setLocal={setLocal}
              readOnly={readOnly}
            />
          )}
        </div>

        {!readOnly && stepType !== "trigger" && (
          <div className="mt-6 flex justify-end">
            <Button onClick={() => onSave(local)}>Salvar etapa</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SendEmailForm({
  local,
  setLocal,
  readOnly,
}: {
  local: Record<string, unknown>;
  // eslint-disable-next-line no-unused-vars
  setLocal: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  return (
    <>
      <Field label="Assunto">
        <Input
          value={(local.subject as string) ?? ""}
          disabled={readOnly}
          onChange={(e) =>
            setLocal((prev) => ({ ...prev, subject: e.target.value }))
          }
        />
      </Field>
      <Field label="De">
        <Input
          value={(local.from as string) ?? ""}
          disabled={readOnly}
          placeholder="nome@seudominio.com"
          onChange={(e) =>
            setLocal((prev) => ({ ...prev, from: e.target.value }))
          }
        />
      </Field>
      <Field label="Conteúdo (HTML)">
        <Textarea
          rows={10}
          value={(local.html as string) ?? ""}
          disabled={readOnly}
          onChange={(e) =>
            setLocal((prev) => ({ ...prev, html: e.target.value }))
          }
        />
      </Field>
    </>
  );
}

function ConditionForm({
  local,
  setLocal,
  readOnly,
}: {
  local: Record<string, unknown>;
  setLocal: (
    // eslint-disable-next-line no-unused-vars
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
  readOnly: boolean;
}) {
  const rules = (local.rules as { match?: string; conditions?: Condition[] }) ?? {
    match: "all",
    conditions: [],
  };
  const conditions = rules.conditions ?? [];

  const updateRules = (next: { match?: string; conditions?: Condition[] }) => {
    setLocal((prev) => ({
      ...prev,
      rules: { ...rules, ...next },
    }));
  };

  return (
    <>
      <Field label="Correspondência">
        <Select
          value={rules.match ?? "all"}
          onValueChange={(val) => updateRules({ match: val })}
          disabled={readOnly}
        >
          <SelectTrigger>
            {rules.match === "any" ? "Qualquer regra" : "Todas as regras"}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as regras</SelectItem>
            <SelectItem value="any">Qualquer regra</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="space-y-3">
        {conditions.map((cond, index) => (
          <div key={index} className="flex flex-col gap-2 border border-border rounded-lg p-3">
            <Input
              placeholder="Campo (ex: properties.plan)"
              value={cond.field}
              disabled={readOnly}
              onChange={(e) => {
                const next = [...conditions];
                next[index] = { ...cond, field: e.target.value };
                updateRules({ conditions: next });
              }}
            />
            <Select
              value={cond.op}
              onValueChange={(val) => {
                const next = [...conditions];
                next[index] = { ...cond, op: val };
                updateRules({ conditions: next });
              }}
              disabled={readOnly}
            >
              <SelectTrigger>{opLabel(cond.op)}</SelectTrigger>
              <SelectContent>
                <SelectItem value="eq">É igual a</SelectItem>
                <SelectItem value="neq">É diferente de</SelectItem>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="in">Está em (lista)</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Valor"
              value={cond.value}
              disabled={readOnly}
              onChange={(e) => {
                const next = [...conditions];
                next[index] = { ...cond, value: e.target.value };
                updateRules({ conditions: next });
              }}
            />
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="self-end text-red"
                onClick={() =>
                  updateRules({
                    conditions: conditions.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateRules({
                conditions: [
                  ...conditions,
                  { field: "", op: "eq", value: "" },
                ],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar regra
          </Button>
        )}
      </div>
    </>
  );
}

function opLabel(op: string) {
  switch (op) {
    case "eq":
      return "É igual a";
    case "neq":
      return "É diferente de";
    case "contains":
      return "Contém";
    case "in":
      return "Está em (lista)";
    default:
      return "Selecione";
  }
}

function DelayForm({
  local,
  setLocal,
  readOnly,
}: {
  local: Record<string, unknown>;
  setLocal: (
    // eslint-disable-next-line no-unused-vars
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
  readOnly: boolean;
}) {
  const { value, unit } = msToValueUnit(local.durationMs as number | undefined);

  const update = (newValue: number, newUnit: "minutes" | "hours" | "days") => {
    setLocal((prev) => ({
      ...prev,
      durationMs: valueUnitToMs(newValue, newUnit),
    }));
  };

  return (
    <Field label="Duração">
      <div className="flex gap-2">
        <Input
          type="number"
          min={1}
          value={value}
          disabled={readOnly}
          onChange={(e) => update(Number(e.target.value), unit)}
        />
        <Select
          value={unit}
          onValueChange={(val) => update(value, val as "minutes" | "hours" | "days")}
          disabled={readOnly}
        >
          <SelectTrigger className="w-[140px]">
            {unit === "minutes" ? "Minutos" : unit === "hours" ? "Horas" : "Dias"}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutos</SelectItem>
            <SelectItem value="hours">Horas</SelectItem>
            <SelectItem value="days">Dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Field>
  );
}

function WaitForEventForm({
  local,
  setLocal,
  readOnly,
}: {
  local: Record<string, unknown>;
  setLocal: (
    // eslint-disable-next-line no-unused-vars
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
  readOnly: boolean;
}) {
  const hasTimeout = local.timeoutMs !== undefined && local.timeoutMs !== null;
  const { value, unit } = msToValueUnit(local.timeoutMs as number | undefined);

  return (
    <>
      <Field label="Nome do evento">
        <Input
          value={(local.eventName as string) ?? ""}
          disabled={readOnly}
          onChange={(e) =>
            setLocal((prev) => ({ ...prev, eventName: e.target.value }))
          }
        />
      </Field>
      <Field label="Tempo limite (opcional)">
        <div className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={hasTimeout}
            disabled={readOnly}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                timeoutMs: e.target.checked ? valueUnitToMs(1, "hours") : undefined,
              }))
            }
          />
          <Input
            type="number"
            min={1}
            disabled={readOnly || !hasTimeout}
            value={value}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                timeoutMs: valueUnitToMs(Number(e.target.value), unit),
              }))
            }
          />
          <Select
            value={unit}
            disabled={readOnly || !hasTimeout}
            onValueChange={(val) =>
              setLocal((prev) => ({
                ...prev,
                timeoutMs: valueUnitToMs(
                  value,
                  val as "minutes" | "hours" | "days",
                ),
              }))
            }
          >
            <SelectTrigger className="w-[140px]">
              {unit === "minutes" ? "Minutos" : unit === "hours" ? "Horas" : "Dias"}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Field>
    </>
  );
}

function UpdateContactForm({
  local,
  setLocal,
  readOnly,
}: {
  local: Record<string, unknown>;
  setLocal: (
    // eslint-disable-next-line no-unused-vars
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
  readOnly: boolean;
}) {
  const properties = (local.properties as Record<string, unknown>) ?? {};
  const entries = Object.entries(properties);

  const setEntries = (next: [string, unknown][]) => {
    setLocal((prev) => ({
      ...prev,
      properties: Object.fromEntries(next),
    }));
  };

  return (
    <div className="space-y-3">
      {entries.map(([key, value], index) => (
        <div key={index} className="flex gap-2">
          <Input
            placeholder="Chave"
            value={key}
            disabled={readOnly}
            onChange={(e) => {
              const next = [...entries];
              next[index] = [e.target.value, value];
              setEntries(next);
            }}
          />
          <Input
            placeholder="Valor"
            value={String(value ?? "")}
            disabled={readOnly}
            onChange={(e) => {
              const next = [...entries];
              next[index] = [key, e.target.value];
              setEntries(next);
            }}
          />
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red"
              onClick={() => setEntries(entries.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEntries([...entries, ["", ""]])}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar propriedade
        </Button>
      )}
    </div>
  );
}

function AddToSegmentForm({
  local,
  setLocal,
  readOnly,
}: {
  local: Record<string, unknown>;
  setLocal: (
    // eslint-disable-next-line no-unused-vars
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
  readOnly: boolean;
}) {
  return (
    <Field label="ID do segmento">
      <Input
        value={(local.segmentId as string) ?? ""}
        disabled={readOnly}
        placeholder="Cole o ID do segmento"
        onChange={(e) =>
          setLocal((prev) => ({ ...prev, segmentId: e.target.value }))
        }
      />
      <p className="text-xs text-muted-foreground mt-1">
        Não há um seletor de segmentos disponível ainda — encontre o ID na
        página de Contatos e cole aqui.
      </p>
    </Field>
  );
}
