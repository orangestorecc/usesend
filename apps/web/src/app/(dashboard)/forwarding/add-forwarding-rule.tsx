"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { toast } from "@usesend/ui/src/toaster";
import { Plus } from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";

const TODOS = "todos";

const schema = z.object({
  origem: z.string(),
  destination: z.string().email("Digite um e-mail válido"),
});

type FormValues = z.infer<typeof schema>;

export function AddForwardingRule() {
  const [open, setOpen] = useState(false);
  const domainsQuery = api.domain.domains.useQuery();
  const createMutation = api.forwarding.create.useMutation();
  const utils = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { origem: TODOS, destination: "" },
  });

  const dominiosComRecebimento =
    domainsQuery.data?.filter((d) => d.receivingEnabled) ?? [];

  function handleSubmit(values: FormValues) {
    createMutation.mutate(
      {
        domainId: values.origem === TODOS ? null : Number(values.origem),
        destination: values.destination,
      },
      {
        onSuccess: async () => {
          await utils.forwarding.list.invalidate();
          form.reset({ origem: TODOS, destination: "" });
          setOpen(false);
          toast.success(
            "Regra criada. Enviamos um e-mail de confirmação para o destino.",
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" />
          Nova regra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaminhar e-mails recebidos</DialogTitle>
        </DialogHeader>
        {dominiosComRecebimento.length === 0 && !domainsQuery.isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nenhum domínio com recebimento ligado. Ative o recebimento em{" "}
            <Link className="underline" href="/domains">
              Domínios
            </Link>{" "}
            para poder encaminhar.
          </p>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6 py-2"
            >
              <FormField
                control={form.control}
                name="origem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domínio de origem</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={TODOS}>
                          Todos os domínios
                        </SelectItem>
                        {dominiosComRecebimento.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Só aparecem domínios com recebimento ligado.
                    </FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caixa de destino</FormLabel>
                    <FormControl>
                      <Input placeholder="voce@gmail.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Mandamos um link de confirmação para este endereço. Nada é
                      encaminhado antes disso.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button
                  className="w-[120px]"
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Criando..." : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
