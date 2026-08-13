"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@usesend/ui/src/button";
import { LockIcon, PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { Input } from "@usesend/ui/src/input";
import { useForm } from "react-hook-form";
import { api } from "~/trpc/react";
import { toast } from "@usesend/ui/src/toaster";
import { z } from "zod";
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
import { useTeam } from "~/providers/team-context";
import { isCloud, isSelfHosted } from "~/utils/common";
import { useUpgradeModalStore } from "~/store/upgradeModalStore";

const inviteTeamMemberSchema = z.object({
  email: z
    .string({ required_error: "O e-mail é obrigatório" })
    .email("Endereço de e-mail inválido"),
  role: z.enum(["ADMIN", "MEMBER"], {
    required_error: "Selecione uma função",
  }),
});

type FormData = z.infer<typeof inviteTeamMemberSchema>;

export default function InviteTeamMember() {
  const { currentIsAdmin } = useTeam();
  const { data: domains } = api.domain.domains.useQuery();

  const limitsQuery = api.limits.teamMembers.useQuery();
  const { openModal } = useUpgradeModalStore((s) => s.action);

  const [open, setOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(inviteTeamMemberSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
    },
  });

  const utils = api.useUtils();

  const createInvite = api.team.createTeamInvite.useMutation();
  const noLimite = Boolean(limitsQuery.data?.isLimitReached);

  // Retorno do checkout: `?intent=invite` é de uso único — consumido antes de
  // qualquer coisa, e só reabre o diálogo depois de reconfirmar o plano no
  // servidor. Reexecutar cego mandaria convite com pagamento ainda pendente.
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get("intent") !== "invite") return;

    const url = new URL(window.location.href);
    url.searchParams.delete("intent");
    router.replace(url.pathname + url.search);

    void limitsQuery.refetch().then(({ data }) => {
      if (data && !data.isLimitReached) {
        setOpen(true);
      } else {
        toast.info(
          "Pagamento em processamento. Assim que ele for confirmado, o convite fica liberado.",
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function onSubmit(values: FormData) {
    if (limitsQuery.data?.isLimitReached) {
      openModal(limitsQuery.data.reason);
      return;
    }

    createInvite.mutate(
      {
        email: values.email,
        role: values.role,
        sendEmail: true,
      },
      {
        onSuccess: () => {
          form.reset();
          setOpen(false);
          void utils.team.getTeamInvites.invalidate();
          toast.success("Convite enviado com sucesso");
        },
        onError: (error) => {
          console.error(error);
          toast.error(error.message || "Falha ao enviar o convite");
        },
      },
    );
  }

  async function onCopyLink() {
    if (limitsQuery.data?.isLimitReached) {
      openModal(limitsQuery.data.reason);
      return;
    }

    createInvite.mutate(
      {
        email: form.getValues("email"),
        role: form.getValues("role"),
        sendEmail: false,
      },
      {
        onSuccess: (invite) => {
          void utils.team.getTeamInvites.invalidate();
          navigator.clipboard.writeText(
            `${location.origin}/join-team?inviteId=${invite.id}`,
          );
          form.reset();
          setOpen(false);
          toast.success("Link do convite copiado para a área de transferência");
        },
        onError: (error) => {
          console.error(error);
          toast.error(error.message || "Falha ao copiar o link do convite");
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

  if (!currentIsAdmin) {
    return null;
  }

  // Hint permanente: descobrir o limite só na hora de convidar é o que faz a
  // pessoa achar que o produto quebrou.
  const hint =
    limitsQuery.data && limitsQuery.data.limit > 0
      ? `${limitsQuery.data.atual} de ${limitsQuery.data.limit} ${
          limitsQuery.data.limit === 1 ? "membro" : "membros"
        } no seu plano`
      : null;

  return (
    <div className="flex items-center gap-3">
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? onOpenChange(_open) : null)}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          {noLimite ? (
            <>
              <LockIcon className="mr-2 h-4 w-4" />
              Fazer upgrade para convidar
            </>
          ) : (
            <>
              <PlusIcon className="mr-2 h-4 w-4" />
              Convidar membro
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className=" max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar membro do time</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field, formState }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input placeholder="colega@exemplo.com" {...field} />
                  </FormControl>
                  {formState.errors.email ? (
                    <FormMessage />
                  ) : (
                    <FormDescription>
                      Informe o endereço de e-mail do seu colega
                    </FormDescription>
                  )}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <div className="capitalize">
                          {field.value.toLowerCase()}
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ADMIN">
                        <div>Administrador</div>
                        <div className="text-xs text-muted-foreground">
                          Gerenciar usuários, atualizar pagamentos
                        </div>
                      </SelectItem>
                      <SelectItem value="MEMBER">
                        <div>Membro</div>
                        <div className="text-xs text-muted-foreground">
                          Gerenciar e-mails, domínios e contatos
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isSelfHosted() && domains?.length ? (
              <div className="text-sm text-muted-foreground">
                Será usado{" "}
                <span className="font-bold">hello@{domains[0]?.name}</span> para
                enviar o convite
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              {isSelfHosted() ? (
                <Button
                  disabled={createInvite.isPending || limitsQuery.isLoading}
                  isLoading={createInvite.isPending}
                  className="w-[150px]"
                  onClick={form.handleSubmit(onCopyLink)}
                >
                  Copiar convite
                </Button>
              ) : null}
              {isCloud() || domains?.length ? (
                <Button
                  type="submit"
                  disabled={createInvite.isPending || limitsQuery.isLoading}
                  isLoading={createInvite.isPending}
                  className="w-[150px]"
                >
                  Enviar convite
                </Button>
              ) : null}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </div>
  );
}
