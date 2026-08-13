"use client";

import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
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
import FromAddressField from "~/components/from-address-field";
import DomainStatusAlert, {
  estadoDosDominios,
} from "~/components/domain-status-alert";

const campaignSchema = z.object({
  name: z.string({ required_error: "O nome é obrigatório" }).min(1, {
    message: "O nome é obrigatório",
  }),
  from: z.string({ required_error: "O e-mail de origem é obrigatório" }).min(1, {
    message: "O e-mail de origem é obrigatório",
  }),
  subject: z.string({ required_error: "O assunto é obrigatório" }).min(1, {
    message: "O assunto é obrigatório",
  }),
  contactBookId: z
    .string({ required_error: "Escolha para quem enviar" })
    .min(1, { message: "Escolha para quem enviar" }),
});

export default function CreateCampaign() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [nomeDaNovaLista, setNomeDaNovaLista] = useState("");

  const createCampaignMutation = api.campaign.createCampaign.useMutation();
  const criarListaMutation = api.contacts.createContactBook.useMutation();
  const dominiosQuery = api.domain.domains.useQuery();
  const listasQuery = api.contacts.getContactBooks.useQuery({});

  const estadoDominios = estadoDosDominios(
    dominiosQuery.data,
    dominiosQuery.isLoading,
  );
  const dominiosVerificados = (dominiosQuery.data ?? [])
    .filter((d) => d.status === "SUCCESS")
    .map((d) => d.name);

  const campaignForm = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      from: "",
      subject: "",
      contactBookId: "",
    },
  });

  const utils = api.useUtils();

  async function onCampaignCreate(values: z.infer<typeof campaignSchema>) {
    createCampaignMutation.mutate(
      {
        name: values.name,
        from: values.from,
        subject: values.subject,
        contactBookId: values.contactBookId,
      },
      {
        onSuccess: async (data) => {
          utils.campaign.getCampaigns.invalidate();
          router.push(`/campaigns/${data.id}/edit`);
          toast.success("Campanha criada com sucesso");
          setOpen(false);
        },
        onError: async (error) => {
          toast.error(error.message);
        },
      }
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
          Criar campanha
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar nova campanha</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Form {...campaignForm}>
            <form
              onSubmit={campaignForm.handleSubmit(onCampaignCreate)}
              className="space-y-8"
            >
              <FormField
                control={campaignForm.control}
                name="name"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome da campanha" {...field} />
                    </FormControl>
                    {formState.errors.name ? <FormMessage /> : null}
                  </FormItem>
                )}
              />
              <DomainStatusAlert
                estado={estadoDominios}
                dominios={dominiosQuery.data}
              />

              <FormField
                control={campaignForm.control}
                name="from"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormControl>
                      <FromAddressField
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        dominiosVerificados={dominiosVerificados}
                        disabled={estadoDominios !== "ok"}
                      />
                    </FormControl>
                    {formState.errors.from ? <FormMessage /> : null}
                  </FormItem>
                )}
              />
              <FormField
                control={campaignForm.control}
                name="subject"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>Assunto</FormLabel>
                    <FormControl>
                      <Input placeholder="Assunto da campanha" {...field} />
                    </FormControl>
                    {formState.errors.subject ? <FormMessage /> : null}
                  </FormItem>
                )}
              />
              <FormField
                control={campaignForm.control}
                name="contactBookId"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>Enviar para qual lista</FormLabel>
                    <FormControl>
                      {listasQuery.data && listasQuery.data.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 flex flex-col gap-2">
                          <p className="text-sm text-muted-foreground">
                            Você ainda não tem nenhuma lista de contatos. Crie a
                            primeira aqui mesmo — o resto do formulário continua
                            preenchido.
                          </p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nome da lista (ex.: Clientes)"
                              value={nomeDaNovaLista}
                              onChange={(e) =>
                                setNomeDaNovaLista(e.target.value)
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              disabled={
                                criarListaMutation.isPending ||
                                nomeDaNovaLista.trim().length === 0
                              }
                              onClick={() => {
                                criarListaMutation.mutate(
                                  { name: nomeDaNovaLista.trim() },
                                  {
                                    onSuccess: async (lista) => {
                                      await utils.contacts.getContactBooks.invalidate();
                                      field.onChange(lista.id);
                                      setNomeDaNovaLista("");
                                      toast.success("Lista criada");
                                    },
                                    onError: (error) =>
                                      toast.error(error.message),
                                  },
                                );
                              }}
                            >
                              {criarListaMutation.isPending ? (
                                <Spinner className="w-4 h-4" />
                              ) : (
                                "Criar lista"
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha uma lista" />
                          </SelectTrigger>
                          <SelectContent>
                            {(listasQuery.data ?? []).map((lista) => (
                              <SelectItem key={lista.id} value={lista.id}>
                                {lista.emoji} {lista.name} ·{" "}
                                {lista._count.contacts}{" "}
                                {lista._count.contacts === 1
                                  ? "contato"
                                  : "contatos"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormControl>
                    {formState.errors.contactBookId ? <FormMessage /> : null}
                  </FormItem>
                )}
              />
              <p className="text-muted-foreground text-sm">
                Não se preocupe, você pode alterar depois.
              </p>
              <div className="flex justify-end">
                <Button
                  className=" w-[100px]"
                  type="submit"
                  disabled={
                    createCampaignMutation.isPending ||
                    estadoDominios === "nenhum" ||
                    estadoDominios === "em-verificacao"
                  }
                  title={
                    estadoDominios === "nenhum"
                      ? "Verifique um domínio antes de criar campanhas"
                      : estadoDominios === "em-verificacao"
                        ? "Aguarde a verificação do domínio terminar"
                        : undefined
                  }
                >
                  {createCampaignMutation.isPending ? (
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
