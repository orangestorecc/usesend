"use client";

import { Button } from "@usesend/ui/src/button";
import { api } from "~/trpc/react";
import React from "react";
import { Pause, Play } from "lucide-react";
import { AutomationStatus } from "@prisma/client";
import { toast } from "@usesend/ui/src/toaster";

export const ToggleAutomation: React.FC<{
  automation: { id: string; status: AutomationStatus };
  mode?: "icon" | "full";
}> = ({ automation, mode = "icon" }) => {
  const utils = api.useUtils();
  const enableMutation = api.automation.enable.useMutation();
  const disableMutation = api.automation.disable.useMutation();

  const isEnabled = automation.status === AutomationStatus.ENABLED;

  const onToggle = () => {
    if (isEnabled) {
      disableMutation.mutate(
        { id: automation.id },
        {
          onSuccess: () => {
            utils.automation.list.invalidate();
            utils.automation.get.invalidate();
            toast.success("Automação desativada");
          },
          onError: (error) => {
            toast.error(error.message);
          },
        },
      );
    } else {
      enableMutation.mutate(
        { id: automation.id },
        {
          onSuccess: () => {
            utils.automation.list.invalidate();
            utils.automation.get.invalidate();
            toast.success("Automação ativada");
          },
          onError: (error) => {
            toast.error(error.message);
          },
        },
      );
    }
  };

  const pending = enableMutation.isPending || disableMutation.isPending;

  if (
    automation.status !== AutomationStatus.ENABLED &&
    automation.status !== AutomationStatus.DISABLED
  ) {
    return null;
  }

  return (
    <>
      {mode === "icon" ? (
        <Button
          variant="ghost"
          size="sm"
          className="p-0 hover:bg-transparent"
          onClick={onToggle}
          disabled={pending}
          title={isEnabled ? "Desativar" : "Ativar"}
        >
          {isEnabled ? (
            <Pause className="h-[18px] w-[18px] text-orange/80" />
          ) : (
            <Play className="h-[18px] w-[18px] text-green/80" />
          )}
        </Button>
      ) : (
        <Button
          variant="default"
          className="gap-2 border-primary"
          onClick={onToggle}
          disabled={pending}
          title={isEnabled ? "Desativar" : "Ativar"}
        >
          {isEnabled ? (
            <>
              <Pause className="h-[18px] w-[18px]" />
              <span>Desativar</span>
            </>
          ) : (
            <>
              <Play className="h-[18px] w-[18px]" />
              <span>Ativar</span>
            </>
          )}
        </Button>
      )}
    </>
  );
};

export default ToggleAutomation;
