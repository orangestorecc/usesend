"use client";

import { Button } from "@usesend/ui/src/button";
import { DeleteResource } from "~/components/DeleteResource";
import { api } from "~/trpc/react";
import { Contact } from "@prisma/client";
import { toast } from "@usesend/ui/src/toaster";
import { Trash2 } from "lucide-react";
import { z } from "zod";

export const DeleteContact: React.FC<{
  contact: Partial<Contact> & { id: string; contactBookId: string };
}> = ({ contact }) => {
  const deleteContactMutation = api.contacts.deleteContact.useMutation();
  const utils = api.useUtils();

  const contactSchema = z
    .object({
      confirmation: z.string().email("Digite um e-mail válido"),
    })
    .refine((data) => data.confirmation === contact.email, {
      message: "O e-mail não corresponde",
      path: ["confirmation"],
    });

  async function onContactDelete(values: z.infer<typeof contactSchema>) {
    deleteContactMutation.mutate(
      {
        contactId: contact.id,
        contactBookId: contact.contactBookId,
      },
      {
        onSuccess: () => {
          utils.contacts.contacts.invalidate();
          toast.success(`Contato excluído`);
        },
        onError: (e) => {
          toast.error(`Contato não excluído: ${e.message}`);
        },
      },
    );
  }

  return (
    <DeleteResource
      title="Excluir contato"
      resourceName={contact.email || ""}
      schema={contactSchema}
      isLoading={deleteContactMutation.isPending}
      onConfirm={onContactDelete}
      trigger={
        <Button variant="ghost" size="sm">
          <Trash2 className="h-4 w-4 text-red/80" />
        </Button>
      }
      confirmLabel="Excluir contato"
    />
  );
};

export default DeleteContact;
