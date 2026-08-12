"use client";

import { Button } from "@usesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import { api } from "~/trpc/react";
import React, { useState } from "react";
import { toast } from "@usesend/ui/src/toaster";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";

export const DuplicateAutomation: React.FC<{
  automation: { id: string; name: string };
  // eslint-disable-next-line no-unused-vars
  onDuplicated?: (newId: string) => void;
  trigger?: React.ReactNode;
}> = ({ automation, onDuplicated, trigger }) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const duplicateAutomationMutation = api.automation.duplicate.useMutation();

  const utils = api.useUtils();

  async function onAutomationDuplicate() {
    duplicateAutomationMutation.mutate(
      {
        id: automation.id,
      },
      {
        onSuccess: (data) => {
          utils.automation.list.invalidate();
          setOpen(false);
          toast.success("Automação duplicada");
          if (onDuplicated) {
            onDuplicated(data.id);
          } else {
            router.push(`/automations/${data.id}/edit`);
          }
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? setOpen(_open) : null)}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="p-0 hover:bg-transparent">
            <Copy className="h-[18px] w-[18px] text-blue/80" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicar automação</DialogTitle>
          <DialogDescription>
            Tem certeza de que deseja duplicar{" "}
            <span className="font-semibold text-foreground">
              {automation.name}
            </span>
            ?
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <div className="flex justify-end">
            <Button
              onClick={onAutomationDuplicate}
              variant="default"
              disabled={duplicateAutomationMutation.isPending}
            >
              {duplicateAutomationMutation.isPending
                ? "Duplicando..."
                : "Duplicar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateAutomation;
