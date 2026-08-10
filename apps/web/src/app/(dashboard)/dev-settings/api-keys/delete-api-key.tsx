"use client";

import { Button } from "@usesend/ui/src/button";
import { DeleteResource } from "~/components/DeleteResource";
import { api } from "~/trpc/react";
import { ApiKey } from "@prisma/client";
import { toast } from "@usesend/ui/src/toaster";
import { Trash2 } from "lucide-react";
import { z } from "zod";

export const DeleteApiKey: React.FC<{
  apiKey: Partial<ApiKey> & { id: number };
}> = ({ apiKey }) => {
  const deleteApiKeyMutation = api.apiKey.deleteApiKey.useMutation();
  const utils = api.useUtils();

  const apiKeySchema = z
    .object({
      confirmation: z
        .string()
        .min(1, "Digite o nome da chave de API para confirmar"),
    })
    .refine((data) => data.confirmation === apiKey.name, {
      message: "O nome da chave de API não corresponde",
      path: ["confirmation"],
    });

  async function onApiKeyDelete(values: z.infer<typeof apiKeySchema>) {
    deleteApiKeyMutation.mutate(
      {
        id: apiKey.id,
      },
      {
        onSuccess: () => {
          utils.apiKey.invalidate();
          toast.success(`Chave de API excluída`);
        },
      },
    );
  }

  return (
    <DeleteResource
      title="Excluir chave de API"
      resourceName={apiKey.name || ""}
      schema={apiKeySchema}
      isLoading={deleteApiKeyMutation.isPending}
      onConfirm={onApiKeyDelete}
      trigger={
        <Button variant="ghost" size="sm">
          <Trash2 className="h-4 w-4 text-red/80" />
        </Button>
      }
      confirmLabel="Excluir chave de API"
    />
  );
};

export default DeleteApiKey;
