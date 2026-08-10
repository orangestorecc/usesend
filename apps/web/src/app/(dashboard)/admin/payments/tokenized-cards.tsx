"use client";

import { useState } from "react";
import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { toast } from "@usesend/ui/src/toaster";
import { CreditCardIcon } from "lucide-react";
import { api } from "~/trpc/react";

function expiryLabel(month: number | null, year: number | null): string {
  if (!month || !year) return "—";
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

function isExpired(month: number | null, year: number | null): boolean {
  if (!month || !year) return false;
  const now = new Date();
  const exp = new Date(year, month, 0, 23, 59, 59);
  return exp.getTime() < now.getTime();
}

/**
 * Cartões tokenizados guardados para recorrência. O número do cartão fica no
 * cofre da Rede — aqui só temos bandeira, final e validade.
 */
export function TokenizedCards() {
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = api.paymentGateway.tokenizedCards.useQuery({
    search: search || undefined,
    page,
  });

  const del = api.paymentGateway.deleteTokenizedCard.useMutation({
    onSuccess: () => {
      utils.paymentGateway.tokenizedCards.invalidate();
      toast.success("Cartão removido. Recorrências futuras vão exigir um novo.");
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.perPage))
    : 1;

  return (
    <div className="rounded-xl border shadow-sm">
      <div className="border-b p-6">
        <h2 className="text-base font-semibold">Cartões tokenizados</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tokens guardados para cobrança recorrente. O número completo fica no
          cofre da Rede — nunca no nosso banco.
        </p>
      </div>

      <div className="border-b p-4">
        <Input
          className="h-9 w-64"
          placeholder="Buscar por final, bandeira ou titular…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {query.isLoading ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">Carregando…</p>
      ) : query.data?.cards.length ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Cartão</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Adicionado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.cards.map((c) => {
                const expired = isExpired(c.expMonth, c.expYear);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{c.teamName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          {c.brand ?? "cartão"} ••••{c.last4 ?? "????"}
                        </span>
                        {c.isDefault ? (
                          <Badge variant="outline">padrão</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.holderName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-mono text-sm ${
                          expired ? "text-destructive" : ""
                        }`}
                      >
                        {expiryLabel(c.expMonth, c.expYear)}
                      </span>
                      {expired ? (
                        <Badge variant="destructive" className="ml-2">
                          vencido
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        className="text-xs text-destructive underline"
                        onClick={() => {
                          if (
                            confirm(
                              `Remover o cartão ••••${c.last4} do time ${c.teamName}? As cobranças recorrentes vão falhar até o cliente cadastrar outro.`,
                            )
                          ) {
                            del.mutate({ id: c.id });
                          }
                        }}
                      >
                        remover
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t px-6 py-3 text-sm">
            <span className="text-muted-foreground">
              {query.data.total} cartão(ões)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="px-6 py-8 text-sm text-muted-foreground">
          Nenhum cartão tokenizado ainda.
        </p>
      )}
    </div>
  );
}
