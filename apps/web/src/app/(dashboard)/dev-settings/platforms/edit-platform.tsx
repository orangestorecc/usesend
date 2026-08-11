"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { Badge } from "@usesend/ui/src/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { toast } from "@usesend/ui/src/toaster";
import { formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";

type Integracao = {
  id: string;
  name: string;
  baseUrl: string;
  contactBookId: string;
  intervalMinutes: number;
  subscribeMode: string;
};

/**
 * Edição de uma integração + histórico das sincronizações.
 *
 * A chave de API fica em branco de propósito: ela é guardada criptografada e
 * nunca volta para o cliente, então só é enviada quando o usuário digita uma
 * nova.
 */
export default function EditPlatform({
  integration,
  onClose,
}: {
  integration: Integracao;
  onClose: () => void;
}) {
  const [name, setName] = useState(integration.name);
  const [baseUrl, setBaseUrl] = useState(integration.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [bookId, setBookId] = useState(integration.contactBookId);
  const [interval, setInterval] = useState(String(integration.intervalMinutes));
  const [subscribeMode, setSubscribeMode] = useState(integration.subscribeMode);

  const utils = api.useUtils();
  const booksQuery = api.platformIntegration.contactBooks.useQuery();
  const runsQuery = api.platformIntegration.syncRuns.useQuery({
    id: integration.id,
    limit: 20,
  });
  const updateMutation = api.platformIntegration.update.useMutation({
    onSuccess: () => {
      toast.success("Integração atualizada.");
      utils.platformIntegration.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function salvar() {
    updateMutation.mutate({
      id: integration.id,
      name,
      baseUrl,
      apiKey: apiKey || undefined,
      contactBookId: bookId,
      intervalMinutes: Number(interval),
      subscribeMode: subscribeMode as "newsletter" | "all" | "none",
    });
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar integração — {integration.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da integração</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>URL completa da API</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div>
            <Label>Chave de API</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="Deixe em branco para manter a atual"
            />
          </div>

          <div>
            <Label>Lista de contatos (destino)</Label>
            <Select value={bookId} onValueChange={setBookId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {booksQuery.data?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sincronizar a cada</Label>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Inscrição (consentimento)</Label>
              <Select value={subscribeMode} onValueChange={setSubscribeMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newsletter">
                    Respeitar Newsletter da loja
                  </SelectItem>
                  <SelectItem value="all">Todos como inscritos</SelectItem>
                  <SelectItem value="none">Todos como não inscritos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={salvar} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold">
              Histórico de sincronizações
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              As 20 últimas execuções, automáticas e manuais.
            </p>

            {runsQuery.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
            ) : !runsQuery.data?.length ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhuma sincronização registrada ainda.
              </p>
            ) : (
              <div className="mt-3 rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Importados</TableHead>
                      <TableHead className="text-right">Ignorados</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runsQuery.data.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(r.startedAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          {r.status === "ok" ? (
                            <Badge variant="outline">ok</Badge>
                          ) : (
                            <Badge variant="destructive">erro</Badge>
                          )}
                          {r.error ? (
                            <div
                              className="mt-1 max-w-[220px] truncate text-xs text-destructive"
                              title={r.error}
                            >
                              {r.error}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.created}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.skipped}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {r.durationMs != null
                            ? `${(r.durationMs / 1000).toFixed(1)}s`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              &quot;Ignorados&quot; são clientes da loja sem e-mail válido, que
              não podem virar contato.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
