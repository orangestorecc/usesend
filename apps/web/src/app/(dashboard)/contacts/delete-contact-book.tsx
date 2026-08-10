"use client";

import { Button } from "@usesend/ui/src/button";
import { DeleteResource } from "~/components/DeleteResource";
import { api } from "~/trpc/react";
import { ContactBook } from "@prisma/client";
import { toast } from "@usesend/ui/src/toaster";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import type { ReactNode } from "react";

export const DeleteContactBook: React.FC<{
  contactBook: Partial<ContactBook> & { id: string };
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
}> = ({ contactBook, trigger, open, onOpenChange, onSuccess }) => {
  const deleteContactBookMutation =
    api.contacts.deleteContactBook.useMutation();
  const utils = api.useUtils();

  const contactBookSchema = z
    .object({
      confirmation: z
        .string()
        .min(1, "Digite o nome da lista de contatos para confirmar"),
    })
    .refine((data) => data.confirmation === contactBook.name, {
      message: "O nome da lista de contatos não corresponde",
      path: ["confirmation"],
    });

  async function onContactBookDelete(
    values: z.infer<typeof contactBookSchema>,
  ) {
    deleteContactBookMutation.mutate(
      {
        contactBookId: contactBook.id,
      },
      {
        onSuccess: async () => {
          utils.contacts.getContactBooks.invalidate();
          await onSuccess?.();
          toast.success(`Lista de contatos excluída`);
        },
      },
    );
  }

  const dialogTrigger =
    trigger ??
    (open === undefined ? (
      <Button variant="ghost" size="sm" className="p-0 hover:bg-transparent ">
        <Trash2 className="h-[18px] w-[18px] text-red/80 hover:text-red/70" />
      </Button>
    ) : null);

  return (
    <DeleteResource
      title="Excluir lista de contatos"
      resourceName={contactBook.name || ""}
      schema={contactBookSchema}
      isLoading={deleteContactBookMutation.isPending}
      onConfirm={onContactBookDelete}
      open={open}
      onOpenChange={onOpenChange}
      trigger={dialogTrigger}
      confirmLabel="Excluir lista de contatos"
    />
  );
};

export default DeleteContactBook;
