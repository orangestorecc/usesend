"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { format, formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";
import Spinner from "@usesend/ui/src/spinner";
import { Button } from "@usesend/ui/src/button";
import { Trash2 } from "lucide-react";
import { toast } from "@usesend/ui/src/toaster";
import { useState } from "react";

type Scopes = {
  contacts?: string;
  lists?: string;
  templates?: string;
  segments?: string;
  campaigns?: string;
  analytics?: string;
  reputation?: string;
  send?: boolean;
};

/**
 * O que essa chave faz, em português. A versão anterior ("contatos:rw ·
 * listas:rw · envio:on") era ilegível até para quem programa.
 */
function resumoDeAcesso(scopes: Scopes): string {
  const escreve = (v?: string) => v === "write";
  const le = (v?: string) => v === "read" || v === "write";

  const podeAlterar = [
    escreve(scopes.contacts) && "contatos",
    escreve(scopes.lists) && "listas",
    escreve(scopes.templates) && "modelos",
    escreve(scopes.segments) && "segmentos",
    escreve(scopes.campaigns) && "campanhas",
  ].filter(Boolean) as string[];

  const soLeitura = [
    !escreve(scopes.contacts) && le(scopes.contacts) && "contatos",
    !escreve(scopes.lists) && le(scopes.lists) && "listas",
    !escreve(scopes.templates) && le(scopes.templates) && "modelos",
    !escreve(scopes.segments) && le(scopes.segments) && "segmentos",
    !escreve(scopes.campaigns) && le(scopes.campaigns) && "campanhas",
    le(scopes.analytics) && "relatórios",
    le(scopes.reputation) && "entregabilidade",
  ].filter(Boolean) as string[];

  const partes: string[] = [];
  if (podeAlterar.length) partes.push(`Altera ${podeAlterar.join(", ")}`);
  if (soLeitura.length) partes.push(`vê ${soLeitura.join(", ")}`);
  if (!partes.length) return "Sem acesso a nada";
  return partes.join(" · ");
}

export default function McpList() {
  const keysQuery = api.mcp.getMcpKeys.useQuery();
  const deleteMutation = api.mcp.deleteMcpKey.useMutation();
  const utils = api.useUtils();
  const [paraApagar, setParaApagar] = useState<{
    id: string;
    name: string;
  } | null>(null);

  function confirmarExclusao() {
    if (!paraApagar) return;
    deleteMutation.mutate(
      { id: paraApagar.id },
      {
        onSuccess: () => {
          utils.mcp.invalidate();
          setParaApagar(null);
          toast.success("Desligado. O acesso cai em até um minuto.");
        },
        onError: (e) =>
          toast.error(e.message ?? "Não foi possível desligar. Tente de novo."),
      },
    );
  }

  return (
    <div className="mt-10">
      <div className="border rounded-xl shadow">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="rounded-tl-xl">Nome</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead>O que pode fazer</TableHead>
              <TableHead>Envia e-mail?</TableHead>
              <TableHead>Último uso</TableHead>
              <TableHead>Vale até</TableHead>
              <TableHead className="rounded-tr-xl">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keysQuery.isLoading ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="text-center py-4">
                  <Spinner
                    className="w-6 h-6 mx-auto"
                    innerSvgClass="stroke-primary"
                  />
                </TableCell>
              </TableRow>
            ) : keysQuery.data?.length === 0 ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="text-center py-4">
                  <p>Nenhuma chave criada</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se você ligou pelo ChatGPT ou pelo Claude, a conexão aparece
                    aqui assim que for autorizada.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              keysQuery.data?.map((k) => {
                const scopes = (k.scopes ?? {}) as Scopes;
                return (
                  <TableRow key={k.id}>
                    <TableCell>{k.name}</TableCell>
                    <TableCell>{k.partialToken}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {resumoDeAcesso(scopes)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {scopes.send ? (
                        <span className="text-amber-600">Sim</span>
                      ) : (
                        <span className="text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {k.lastUsed
                        ? formatDistanceToNow(k.lastUsed, { addSuffix: true })
                        : "Nunca"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {k.expiresAt ? (
                        k.expiresAt < new Date() ? (
                          <span className="text-red-500">Venceu</span>
                        ) : (
                          format(k.expiresAt, "dd/MM/yyyy")
                        )
                      ) : (
                        <span className="text-muted-foreground">Sem prazo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setParaApagar({ id: k.id, name: k.name })
                        }
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(paraApagar)}
        onOpenChange={(open) => (open ? null : setParaApagar(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desligar “{paraApagar?.name}”?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ele perde o acesso à sua conta em até um minuto. As campanhas e os
            contatos que já foram criados continuam onde estão.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParaApagar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarExclusao}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Desligando..." : "Desligar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
