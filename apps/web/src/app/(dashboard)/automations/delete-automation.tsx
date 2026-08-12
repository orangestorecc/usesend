"use client";

import { Button } from "@usesend/ui/src/button";
import { DeleteResource } from "~/components/DeleteResource";
import { api } from "~/trpc/react";
import { toast } from "@usesend/ui/src/toaster";
import { Trash2 } from "lucide-react";
import { z } from "zod";

export const DeleteAutomation: React.FC<{
  automation: { id: string; name: string };
  onDeleted?: () => void;
}> = ({ automation, onDeleted }) => {
  const deleteAutomationMutation = api.automation.delete.useMutation();
  const utils = api.useUtils();

  const automationSchema = z
    .object({
      confirmation: z
        .string()
        .min(1, "Digite o nome da automação para confirmar"),
    })
    .refine((data) => data.confirmation === automation.name, {
      message: "O nome da automação não corresponde",
      path: ["confirmation"],
    });

  async function onAutomationDelete(
    // eslint-disable-next-line no-unused-vars
    values: z.infer<typeof automationSchema>,
  ) {
    deleteAutomationMutation.mutate(
      {
        id: automation.id,
      },
      {
        onSuccess: () => {
          utils.automation.list.invalidate();
          toast.success("Automação excluída");
          onDeleted?.();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  }

  return (
    <DeleteResource
      title="Excluir automação"
      resourceName={automation.name || ""}
      schema={automationSchema}
      isLoading={deleteAutomationMutation.isPending}
      onConfirm={onAutomationDelete}
      trigger={
        <Button variant="ghost" size="sm" className="p-0 hover:bg-transparent">
          <Trash2 className="h-[18px] w-[18px] text-red/80" />
        </Button>
      }
      confirmLabel="Excluir automação"
    />
  );
};

export default DeleteAutomation;
