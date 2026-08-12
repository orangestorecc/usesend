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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";

import { api } from "~/trpc/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@usesend/ui/src/toaster";
import { useRouter } from "next/navigation";
import Spinner from "@usesend/ui/src/spinner";

const automationSchema = z.object({
  name: z.string({ required_error: "O nome é obrigatório" }).min(1, {
    message: "O nome é obrigatório",
  }),
  triggerEventName: z
    .string({ required_error: "O evento de gatilho é obrigatório" })
    .min(1, {
      message: "O evento de gatilho é obrigatório",
    }),
});

export default function CreateAutomation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const createAutomationMutation = api.automation.create.useMutation();

  const automationForm = useForm<z.infer<typeof automationSchema>>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: "",
      triggerEventName: "",
    },
  });

  const utils = api.useUtils();

  async function onAutomationCreate(
    values: z.infer<typeof automationSchema>,
  ) {
    createAutomationMutation.mutate(
      {
        name: values.name,
        triggerEventName: values.triggerEventName,
      },
      {
        onSuccess: async (data) => {
          utils.automation.list.invalidate();
          router.push(`/automations/${data.id}/edit`);
          toast.success("Automação criada com sucesso");
          setOpen(false);
        },
        onError: async (error) => {
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
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Criar automação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar nova automação</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Form {...automationForm}>
            <form
              onSubmit={automationForm.handleSubmit(onAutomationCreate)}
              className="space-y-8"
            >
              <FormField
                control={automationForm.control}
                name="name"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome da automação" {...field} />
                    </FormControl>
                    {formState.errors.name ? <FormMessage /> : null}
                  </FormItem>
                )}
              />
              <FormField
                control={automationForm.control}
                name="triggerEventName"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>Evento de gatilho</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: contact.created" {...field} />
                    </FormControl>
                    {formState.errors.triggerEventName ? (
                      <FormMessage />
                    ) : null}
                  </FormItem>
                )}
              />
              <p className="text-muted-foreground text-sm">
                Não se preocupe, você pode alterar depois.
              </p>
              <div className="flex justify-end">
                <Button
                  className="w-[100px]"
                  type="submit"
                  disabled={createAutomationMutation.isPending}
                >
                  {createAutomationMutation.isPending ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    "Criar"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
