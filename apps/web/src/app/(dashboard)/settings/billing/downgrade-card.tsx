"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Card } from "@usesend/ui/src/card";
import { Input } from "@usesend/ui/src/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { toast } from "@usesend/ui/src/toaster";
import Spinner from "@usesend/ui/src/spinner";

import { api } from "~/trpc/react";
import { PLAN_LIMITS } from "~/lib/constants/plans";

/**
 * Downgrade para o plano gratuito.
 *
 * Mora no fim da página, separado do resto e sem destaque: é uma saída, não um
 * caminho sugerido. A confirmação por digitação existe porque a ação é
 * imediata e derruba limites — um clique só, no lugar errado, custaria envios
 * ao cliente no meio de uma campanha.
 */
export function DowngradeCard({ planName }: { planName: string }) {
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const utils = api.useUtils();

  const downgrade = api.payments.downgradeParaGratis.useMutation({
    onSuccess: () => {
      toast.success("Plano alterado para o gratuito.");
      setAberto(false);
      setConfirmacao("");
      void utils.payments.billingState.invalidate();
      void utils.billingProfile.invoices.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Não foi possível trocar o plano."),
  });

  const limite = PLAN_LIMITS.FREE;

  return (
    <Card className="border-destructive/30 p-6">
      <h2 className="text-base font-semibold">Voltar para o plano gratuito</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Você sai do plano {planName} e deixa de ser cobrado. O time continua no
        ar, com os limites do plano gratuito:{" "}
        {limite.emailsPerMonth.toLocaleString("pt-BR")} e-mails por mês e{" "}
        {limite.domains} domínio.
      </p>
      <div className="mt-4">
        <Button variant="outline" onClick={() => setAberto(true)}>
          Fazer downgrade
        </Button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voltar para o plano gratuito?</DialogTitle>
            <DialogDescription>
              A troca vale na hora — a assinatura é cancelada e não há nova
              cobrança. Contatos, domínios e histórico continuam onde estão, mas
              os limites do plano gratuito passam a valer imediatamente, e
              envios acima deles serão recusados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Para confirmar, digite <strong>DOWNGRADE</strong>:
            </p>
            <Input
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value.toUpperCase())}
              placeholder="DOWNGRADE"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmacao !== "DOWNGRADE" || downgrade.isPending}
              onClick={() => downgrade.mutate()}
            >
              {downgrade.isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" /> Alterando...
                </>
              ) : (
                "Confirmar downgrade"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
