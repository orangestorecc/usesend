"use client";

import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
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
import { Edit } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@usesend/ui/src/toaster";
import type { ReactNode } from "react";

const contactBookSchema = z.object({
  name: z.string().min(1, { message: "O nome é obrigatório" }),
  variables: z.string().optional(),
});

export const EditContactBook: React.FC<{
  contactBook: { id: string; name: string; variables?: string[] };
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
}> = ({
  contactBook,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}) => {
  const [open, setOpen] = useState(false);
  const updateContactBookMutation =
    api.contacts.updateContactBook.useMutation();

  const utils = api.useUtils();
  const dialogTrigger =
    trigger ??
    (controlledOpen === undefined ? (
      <Button
        variant="ghost"
        size="sm"
        className="p-0 hover:bg-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <Edit className="h-4 w-4 text-foreground/80 hover:text-foreground/70" />
      </Button>
    ) : null);

  const contactBookForm = useForm<z.infer<typeof contactBookSchema>>({
    resolver: zodResolver(contactBookSchema),
    defaultValues: {
      name: contactBook.name || "",
      variables: (contactBook.variables ?? []).join(", "),
    },
  });

  async function onContactBookUpdate(
    values: z.infer<typeof contactBookSchema>,
  ) {
    updateContactBookMutation.mutate(
      {
        contactBookId: contactBook.id,
        name: values.name,
        variables: values.variables
          ?.split(",")
          .map((variable) => variable.trim())
          .filter(Boolean),
      },
      {
        onSuccess: async () => {
          utils.contacts.getContactBooks.invalidate();
          await onSuccess?.();
          if (controlledOpen === undefined) {
            setOpen(false);
          } else {
            onOpenChange?.(false);
          }
          toast.success("Lista de contatos atualizada com sucesso");
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
          <DialogTitle>Editar lista de contatos</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Form {...contactBookForm}>
            <form
              onSubmit={contactBookForm.handleSubmit(onContactBookUpdate)}
              className="space-y-8"
            >
              <FormField
                control={contactBookForm.control}
                name="name"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome da lista de contatos" {...field} />
                    </FormControl>
                    {formState.errors.name ? <FormMessage /> : null}
                  </FormItem>
                )}
              />
              <FormField
                control={contactBookForm.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variáveis</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="registrationCode, company, plan"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Nomes de variáveis separados por vírgula disponíveis nas
                      campanhas desta lista de contatos.
                    </FormDescription>
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button
                  className=" w-[100px]"
                  type="submit"
                  disabled={updateContactBookMutation.isPending}
                >
                  {updateContactBookMutation.isPending
                    ? "Atualizando..."
                    : "Atualizar"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditContactBook;
