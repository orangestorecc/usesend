"use client";

import { useEffect, useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { toast } from "@usesend/ui/src/toaster";
import { AlertTriangle, Check, Pencil } from "lucide-react";

import { api } from "~/trpc/react";

/** (81) 99999-9999 — só para exibir; o servidor guarda apenas dígitos. */
function formatarWhatsapp(digitos: string): string {
  const d = digitos.replace(/\D/g, "");
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return digitos;
}

function formatarDocumento(d: string): string {
  const v = d.replace(/\D/g, "");
  if (v.length === 11) {
    return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  }
  if (v.length === 14) {
    return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  }
  return d;
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
                — {contato.email} · {formatarWhatsapp(contato.whatsapp)}
                {contato.documento
                  ? ` · ${formatarDocumento(contato.documento)}`
                  : null}
                {contato.razaoSocial ? ` · ${contato.razaoSocial}` : null}
              </p>
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
            para emitir a nota fiscal e avisar sobre a cobrança. Leva menos de
            um minuto e você continua aqui mesmo.
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

function BillingContactDialog({
  inicial,
  emailPadrao,
  onClose,
}: {
  inicial: {
    responsavel: string;
    email: string;
    whatsapp: string;
    documento: string | null;
    razaoSocial: string | null;
  } | null;
  emailPadrao?: string | null;
  onClose: () => void;
}) {
  const [responsavel, setResponsavel] = useState(inicial?.responsavel ?? "");
  const [email, setEmail] = useState(inicial?.email ?? emailPadrao ?? "");
  const [whatsapp, setWhatsapp] = useState(
    inicial ? formatarWhatsapp(inicial.whatsapp) : "",
  );
  const [documento, setDocumento] = useState(
    inicial?.documento ? formatarDocumento(inicial.documento) : "",
  );
  const [razaoSocial, setRazaoSocial] = useState(inicial?.razaoSocial ?? "");

  const utils = api.useUtils();
  const mutation = api.billingContact.upsert.useMutation({
    onSuccess: () => {
      toast.success("Dados de faturamento salvos.");
      utils.billingContact.get.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Responsável financeiro</DialogTitle>
          <DialogDescription>
            Para onde vão a nota fiscal e os avisos de cobrança.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <Label>Nome do responsável</Label>
            <Input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Quem cuida do financeiro"
            />
          </div>

          <div>
            <Label>E-mail para cobrança</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="financeiro@suaempresa.com.br"
            />
          </div>

          <div>
            <Label>WhatsApp</Label>
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(81) 99999-9999"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Opcional agora, mas necessário quando a nota fiscal for emitida.
            </p>
            <div className="mt-3 space-y-4">
              <div>
                <Label>CPF ou CNPJ</Label>
                <Input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label>Razão social ou nome completo</Label>
                <Input
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Como deve sair na nota"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              mutation.mutate({
                responsavel,
                email,
                whatsapp,
                documento: documento || undefined,
                razaoSocial: razaoSocial || undefined,
              })
            }
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Salvando..." : "Salvar e continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
