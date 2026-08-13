"use client";

import { Button } from "@usesend/ui/src/button";
import { Textarea } from "@usesend/ui/src/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";

import { api } from "~/trpc/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@usesend/ui/src/toaster";
import type { ReactNode } from "react";

const contactsSchema = z.object({
  contacts: z.string({ required_error: "Os contatos são obrigatórios" }).min(1, {
    message: "Os contatos são obrigatórios",
  }),
});

export default function AddContact({
  contactBookId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  contactBookId: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  const addContactsMutation = api.contacts.addContacts.useMutation();

  const contactsForm = useForm<z.infer<typeof contactsSchema>>({
    resolver: zodResolver(contactsSchema),
    defaultValues: {
      contacts: "",
    },
  });

  const utils = api.useUtils();
  const dialogTrigger =
    trigger ??
    (controlledOpen === undefined ? (
      <Button>
        <Plus className="h-4 w-4 mr-1" />
        Adicionar contatos
      </Button>
    ) : null);

  async function onContactsAdd(values: z.infer<typeof contactsSchema>) {
    // Aceita virgula, ponto-e-virgula, espaco e quebra de linha como separador,
    // ignora entradas vazias e remove duplicados dentro do mesmo envio.
    const emails = Array.from(
      new Set(
        values.contacts
          .split(/[,;\s]+/)
          .map((email) => email.trim())
          .filter(Boolean),
      ),
    );

    if (emails.length === 0) {
      toast.error("Informe pelo menos um e-mail");
      return;
    }

    const contactsArray = emails.map((email) => ({ email }));

    addContactsMutation.mutate(
      {
        contactBookId,
        contacts: contactsArray,
      },
      {
        onSuccess: async () => {
          utils.contacts.contacts.invalidate();
          if (controlledOpen === undefined) {
            setOpen(false);
          } else {
            onOpenChange?.(false);
          }
          toast.success(
            emails.length === 1
              ? "Contato na fila para processamento"
              : `${emails.length} contatos na fila para processamento`,
          );
        },
        onError: async (error) => {
          toast.error(error.message);
        },
      },
    );
  }

  return (
    <Dialog
      open={controlledOpen ?? open}
      onOpenChange={(nextOpen) => {
        if (controlledOpen === undefined) {
          if (nextOpen !== open) {
            setOpen(nextOpen);
          }
          return;
        }

        onOpenChange?.(nextOpen);
      }}
    >
      {dialogTrigger ? (
        <DialogTrigger asChild>{dialogTrigger}</DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar novos contatos</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Form {...contactsForm}>
            <form
              onSubmit={contactsForm.handleSubmit(onContactsAdd)}
              className="space-y-8"
            >
              <FormField
                control={contactsForm.control}
                name="contacts"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>Contatos</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="email1@example.com, email2@example.com"
                        onKeyDown={(event) => {
                          if (
                            !(event.metaKey || event.ctrlKey) ||
                            event.key !== "Enter"
                          ) {
                            return;
                          }

                          if (addContactsMutation.isPending) {
                            return;
                          }

                          event.preventDefault();
                          void contactsForm.handleSubmit(onContactsAdd)();
                        }}
                        {...field}
                      />
                    </FormControl>
                    {formState.errors.contacts ? (
                      <FormMessage />
                    ) : (
                      <FormDescription>
                        Digite os e-mails separados por vírgula. Pressione
                        Cmd/Ctrl + Enter para enviar.
                      </FormDescription>
                    )}
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button
                  className=" w-[100px]"
                  type="submit"
                  disabled={addContactsMutation.isPending}
                >
                  {addContactsMutation.isPending
                    ? "Adicionando..."
                    : "Adicionar"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
