"use client";

import { useEffect, useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { AlertTriangle, Check, Pencil } from "lucide-react";

import { api } from "~/trpc/react";
import BillingContactDialog from "./billing-contact-dialog";
import {
  formatarDocumento,
  formatarTelefone,
  paisPorCodigo,
  separarTelefone,
} from "~/lib/validadores-br";

/** Mostra com bandeira e DDI, como foi cadastrado. */
function exibirTelefone(guardado: string): string {
  const { codigoPais, numero } = separarTelefone(guardado);
  const pais = paisPorCodigo(codigoPais);
  return `${pais.bandeira} +${pais.ddi} ${formatarTelefone(numero, codigoPais)}`;
}

/**
 * Responsável financeiro no checkout.
 *
 * Fica no fluxo de pagamento de propósito: mandar o cliente para outra tela
 * para cadastrar isso é a forma mais fácil de perder a venda no meio. Quando
 * já existe, o bloco só confirma para onde vai a nota; quando não existe,
 * resolve ali mesmo, num diálogo, e volta para pagar.
 */
export default function BillingContactBlock({
  emailDoMembro,
  onPreenchidoChange,
}: {
  emailDoMembro?: string | null;
  /** Avisa o checkout se já dá para pagar. */
  onPreenchidoChange?: (preenchido: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const contatoQuery = api.billingContact.get.useQuery();
  const contato = contatoQuery.data;

  useEffect(() => {
    if (!contatoQuery.isLoading) {
      onPreenchidoChange?.(!!contato);
    }
  }, [contato, contatoQuery.isLoading, onPreenchidoChange]);

  if (contatoQuery.isLoading) {
    return (
      <div className="rounded-lg border p-3 text-sm text-muted-foreground">
        Carregando dados de faturamento…
      </div>
    );
  }

  return (
    <>
      {contato ? (
        <div className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Check className="h-4 w-4 text-emerald-600" />
                Responsável financeiro
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                A nota fiscal e os avisos de cobrança vão para{" "}
                <span className="font-medium text-foreground">
                  {contato.responsavel}
                </span>{" "}
                — {contato.email} · {exibirTelefone(contato.whatsapp)}
              </p>
              {contato.documento || contato.razaoSocial ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {contato.razaoSocial ?? ""}
                  {contato.razaoSocial && contato.documento ? " · " : ""}
                  {contato.documento
                    ? formatarDocumento(contato.documento)
                    : null}
                  {contato.cidade ? ` · ${contato.cidade}` : ""}
                  {contato.uf ? `/${contato.uf}` : ""}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAberto(true)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Alterar
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Falta o responsável financeiro
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Precisamos de quem responde pelo financeiro, o e-mail e o WhatsApp
            para emitir a nota fiscal e avisar sobre a cobrança. Com o CNPJ, o
            resto vem preenchido da Receita. Você continua aqui mesmo.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => setAberto(true)}
          >
            Adicionar responsável financeiro
          </Button>
        </div>
      )}

      {aberto ? (
        <BillingContactDialog
          inicial={contato ?? null}
          emailPadrao={emailDoMembro}
          onClose={() => setAberto(false)}
        />
      ) : null}
    </>
  );
}
