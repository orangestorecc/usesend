"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@usesend/ui/src/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";
import { Input } from "@usesend/ui/src/input";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";
import { Switch } from "@usesend/ui/src/switch";
import { Badge } from "@usesend/ui/src/badge";
import { formatDistanceToNow } from "date-fns";

import { api } from "~/trpc/react";
import { isCloud } from "~/utils/common";
import type { AppRouter } from "~/server/api/root";
import type { inferRouterOutputs } from "@trpc/server";

const searchSchema = z.object({
  email: z
    .string({ required_error: "O e-mail é obrigatório" })
    .trim()
    .email("Informe um endereço de e-mail válido"),
});

type SearchInput = z.infer<typeof searchSchema>;

type RouterOutputs = inferRouterOutputs<AppRouter>;
type WaitlistUser = NonNullable<RouterOutputs["admin"]["findUserByEmail"]>;

export default function AdminWaitlistPage() {
  const [userResult, setUserResult] = useState<WaitlistUser | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const form = useForm<SearchInput>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      email: "",
    },
  });

  const findUser = api.admin.findUserByEmail.useMutation({
    onSuccess: (data) => {
      setHasSearched(true);
      if (!data) {
        setUserResult(null);
        toast.info("Nenhum usuário encontrado para esse e-mail");
        return;
      }

      setUserResult(data);
    },
    onError: (error) => {
      toast.error(error.message ?? "Não foi possível buscar o usuário");
    },
  });

  const updateWaitlist = api.admin.updateUserWaitlist.useMutation({
    onSuccess: (updated) => {
      setUserResult(updated);
      toast.success(
        updated.isWaitlisted
          ? "Usuário marcado na lista de espera"
          : "Usuário removido da lista de espera",
      );
    },
    onError: (error) => {
      toast.error(error.message ?? "Não foi possível atualizar o status da lista de espera");
    },
  });

  const rejectWaitlist = api.admin.rejectWaitlistUser.useMutation({
    onSuccess: () => {
      toast.success("E-mail de recusa enviado");
    },
    onError: (error) => {
      toast.error(error.message ?? "Não foi possível enviar o e-mail de recusa");
    },
  });

  const onSubmit = (values: SearchInput) => {
    setHasSearched(false);
    setUserResult(null);
    findUser.mutate(values);
  };

  const handleToggle = (checked: boolean) => {
    if (!userResult) return;
    updateWaitlist.mutate({ userId: userResult.id, isWaitlisted: checked });
  };

  const handleReject = () => {
    if (!userResult) return;
    rejectWaitlist.mutate({ userId: userResult.id });
  };

  if (!isCloud()) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
As ferramentas de lista de espera estão disponíveis apenas na implantação em nuvem.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail do usuário</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="user@example.com"
                      autoComplete="off"
                      {...field}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={findUser.isPending}>
              {findUser.isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" /> Buscando...
                </>
              ) : (
                "Buscar usuário"
              )}
            </Button>
          </form>
        </Form>
      </div>

      {findUser.isPending ? null : hasSearched && !userResult ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Nenhum usuário corresponde a esse e-mail. Tente outra pesquisa.
        </div>
      ) : null}

      {userResult ? (
        <div className="space-y-4 rounded-lg border p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p className="text-base font-medium">{userResult.email}</p>
            </div>
            <Badge variant={userResult.isWaitlisted ? "destructive" : "outline"}>
              {userResult.isWaitlisted ? "Na lista de espera" : "Ativo"}
            </Badge>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Nome</p>
              <p>{userResult.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Entrou</p>
              <p>
                {formatDistanceToNow(new Date(userResult.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Acesso à lista de espera</p>
                <p className="text-sm text-muted-foreground">
                  Alterne para controlar se o usuário permanece na lista de espera.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={userResult.isWaitlisted}
                  onCheckedChange={handleToggle}
                  disabled={updateWaitlist.isPending}
                />
                {updateWaitlist.isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Recusar solicitação da lista de espera</p>
                <p className="text-sm text-muted-foreground">
                  Envie ao solicitante um e-mail de recusa sem alterar o status da lista de espera.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={handleReject}
                disabled={rejectWaitlist.isPending}
              >
                {rejectWaitlist.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" /> Enviando...
                  </>
                ) : (
                  "Enviar e-mail de recusa"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
