"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@usesend/ui/src/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@usesend/ui/src/form";
import { Input } from "@usesend/ui/src/input";
import { Spinner } from "@usesend/ui/src/spinner";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { toast } from "@usesend/ui/src/toaster";
import JoinTeam from "./JoinTeam";

const FormSchema = z.object({
  name: z.string().min(2, {
    message: "O nome do workspace deve ter pelo menos 2 caracteres.",
  }),
});

export default function CreateTeam() {
  const createTeam = api.team.createTeam.useMutation();
  const utils = api.useUtils();

  const router = useRouter();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    createTeam.mutate(data, {
      onSuccess: () => {
        utils.team.invalidate();
        router.replace("/dashboard");
      },
      onError: (e) => {
        toast.error(e.message);
      },
    });
  }

  return (
    <div className="flex items-center justify-center min-h-screen ">
      <div className=" w-[400px] flex flex-col gap-8">
        <JoinTeam showCreateTeam />
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold">Como se chama o seu negócio?</h1>
          <p className="text-sm text-muted-foreground">
            Esse nome identifica sua conta no Madmail e aparece para quem você
            convidar depois. Use o nome da sua empresa ou marca.
          </p>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className=" flex flex-col gap-8 w-full"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field, formState }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Ex: Loja do João, Acme Ltda"
                      className="w-full"
                      {...field}
                    />
                  </FormControl>
                  {formState.errors.name ? (
                    <FormMessage />
                  ) : (
                    <FormDescription>
                      Dá para mudar depois em Configurações.
                    </FormDescription>
                  )}
                </FormItem>
              )}
            />
            <Button type="submit" disabled={createTeam.isPending}>
              {createTeam.isPending ? (
                <Spinner className="w-5 h-5" />
              ) : (
                "Criar conta do negócio"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
