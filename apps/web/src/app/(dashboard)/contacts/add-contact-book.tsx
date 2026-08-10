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

import { api } from "~/trpc/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "@usesend/ui/src/toaster";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";
import { useUpgradeModalStore } from "~/store/upgradeModalStore";
import { LimitReason } from "~/lib/constants/plans";

const contactBookSchema = z.object({
  name: z.string({ required_error: "O nome é obrigatório" }).min(1, {
    message: "O nome é obrigatório",
  }),
  variables: z.string().optional(),
});

export default function AddContactBook() {
  const [open, setOpen] = useState(false);
  const createContactBookMutation =
    api.contacts.createContactBook.useMutation();

  const limitsQuery = api.limits.get.useQuery({
    type: LimitReason.CONTACT_BOOK,
  });
  const { openModal } = useUpgradeModalStore((s) => s.action);

  const utils = api.useUtils();

  const contactBookForm = useForm<z.infer<typeof contactBookSchema>>({
    resolver: zodResolver(contactBookSchema),
    defaultValues: {
      name: "",
      variables: "",
    },
  });

  function handleSave(values: z.infer<typeof contactBookSchema>) {
    if (limitsQuery.data?.isLimitReached) {
      openModal(limitsQuery.data.reason);
      return;
    }

    createContactBookMutation.mutate(
      {
        name: values.name,
        variables: values.variables
          ?.split(",")
          .map((variable) => variable.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => {
          utils.contacts.getContactBooks.invalidate();
          contactBookForm.reset();
          setOpen(false);
          toast.success("Lista de contatos criada com sucesso");
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  }

  function onOpenChange(_open: boolean) {
    if (_open && limitsQuery.data?.isLimitReached) {
      openModal(limitsQuery.data.reason);
      return;
    }

    setOpen(_open);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? onOpenChange(_open) : null)}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar lista de contatos
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar uma nova lista de contatos</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Form {...contactBookForm}>
            <form
              onSubmit={contactBookForm.handleSubmit(handleSave)}
              className="space-y-8"
            >
              <FormField
                control={contactBookForm.control}
                name="name"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>Nome da lista de contatos</FormLabel>
                    <FormControl>
                      <Input placeholder="Meus contatos" {...field} />
                    </FormControl>
                    {formState.errors.name ? (
                      <FormMessage />
                    ) : (
                      <FormDescription>
                        ex: nome do produto / site / newsletter
                      </FormDescription>
                    )}
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
                      Nomes de variáveis separados por vírgula (opcional) para
                      personalização de campanhas.
                    </FormDescription>
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button
                  className=" w-[100px]"
                  type="submit"
                  disabled={
                    createContactBookMutation.isPending || limitsQuery.isLoading
                  }
                >
                  {createContactBookMutation.isPending
                    ? "Criando..."
                    : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
