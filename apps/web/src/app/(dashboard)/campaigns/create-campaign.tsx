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
});

export default function CreateCampaign() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const createCampaignMutation = api.campaign.createCampaign.useMutation();
  const dominiosQuery = api.domain.domains.useQuery();

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
    },
  });

  const utils = api.useUtils();

  async function onCampaignCreate(values: z.infer<typeof campaignSchema>) {
    createCampaignMutation.mutate(
      {
        name: values.name,
        from: values.from,
        subject: values.subject,
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
