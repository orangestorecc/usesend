"use client";

import { Button } from "@usesend/ui/src/button";
import { DeleteResource } from "~/components/DeleteResource";
import { api } from "~/trpc/react";
import { Domain } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "@usesend/ui/src/toaster";
import { z } from "zod";

export const DeleteDomain: React.FC<{
  domain: Domain;
  /** Gatilho customizado. Omita ao controlar o diálogo por `open`. */
  trigger?: React.ReactNode;
  /** Volta para /domains ao excluir. Padrão na página de detalhe. */
  redirectOnDelete?: boolean;
  open?: boolean;
  // eslint-disable-next-line no-unused-vars
  onOpenChange?: (open: boolean) => void;
}> = ({
  domain,
  trigger,
  redirectOnDelete = true,
  open,
  onOpenChange,
}) => {
  const deleteDomainMutation = api.domain.deleteDomain.useMutation();
  const utils = api.useUtils();
  const router = useRouter();

  const domainSchema = z
    .object({
      confirmation: z
        .string()
        .min(1, "Digite o nome do domínio para confirmar"),
    })
    .refine((data) => data.confirmation === domain.name, {
      message: "O nome do domínio não corresponde",
      path: ["confirmation"],
    });

  async function onDomainDelete(values: z.infer<typeof domainSchema>) {
    deleteDomainMutation.mutate(
      {
        id: domain.id,
      },
      {
        onSuccess: () => {
          utils.domain.domains.invalidate();
          toast.success(`Domínio ${domain.name} excluído`);
          onOpenChange?.(false);
          if (redirectOnDelete) {
            router.replace("/domains");
          }
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <DeleteResource
      title="Excluir domínio"
      resourceName={domain.name}
      descriptionBody={
        <>
          Excluir{" "}
          <span className="font-semibold text-foreground">{domain.name}</span>{" "}
          remove a identidade no provedor de envio e interrompe o envio e o
          recebimento de e-mails neste domínio. Campanhas e automações que usam
          um remetente deste domínio param de sair. Essa ação não pode ser
          desfeita.
        </>
      }
      schema={domainSchema}
      isLoading={deleteDomainMutation.isPending}
      onConfirm={onDomainDelete}
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        open !== undefined
          ? undefined
          : (trigger ?? (
              <Button variant="destructive" className="w-[150px]" size="sm">
                Excluir domínio
              </Button>
            ))
      }
      confirmLabel="Excluir domínio"
    />
  );
};

export default DeleteDomain;
