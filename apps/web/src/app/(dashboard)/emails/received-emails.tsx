"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import dynamic from "next/dynamic";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { Button } from "@usesend/ui/src/button";
import { SheetTitle, SheetDescription } from "@usesend/ui/src/sheet";
import { api } from "~/trpc/react";

const Sheet = dynamic(
  () => import("@usesend/ui/src/sheet").then((m) => m.Sheet),
  { ssr: false },
);
const SheetContent = dynamic(
  () => import("@usesend/ui/src/sheet").then((m) => m.SheetContent),
  { ssr: false },
);

function InboundDetails({ id }: { id: string }) {
  const query = api.inbound.get.useQuery({ id });
  const email = query.data;
  if (!email) return null;

  return (
    <div className="h-full overflow-auto px-4 no-scrollbar">
      <h1 className="break-all text-lg font-bold">
        {email.subject || "(sem assunto)"}
      </h1>
      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
        <div>
          <span className="text-xs uppercase text-muted-foreground">De</span>
          <div>
            {email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail}
          </div>
        </div>
        <div>
          <span className="text-xs uppercase text-muted-foreground">Para</span>
          <div className="break-all">{email.to.join(", ")}</div>
        </div>
        <div>
          <span className="text-xs uppercase text-muted-foreground">
            Recebido em
          </span>
          <div>{format(new Date(email.receivedAt), "dd/MM/yyyy 'às' HH:mm")}</div>
        </div>
      </div>

      <div className="mb-4 mt-6 rounded-lg border">
        {email.htmlBody ? (
          <iframe
            className="h-[480px] w-full rounded-lg bg-white"
            srcDoc={email.htmlBody}
            sandbox=""
          />
        ) : (
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap p-4 text-sm">
            {email.textBody || "(sem conteúdo)"}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function ReceivedEmails() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const utils = api.useUtils();
  const listQuery = api.inbound.list.useQuery({ page });

  if (!listQuery.isLoading && !listQuery.data?.emails.length) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/30">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-base font-medium">
          Nenhum e-mail recebido ainda
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          E-mails enviados ao seu domínio aparecem aqui em até 1 minuto após o
          recebimento.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>De</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead className="text-right">Recebido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data?.emails.map((e) => (
              <TableRow
                key={e.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelected(e.id);
                  utils.inbound.list.invalidate();
                }}
              >
                <TableCell className={e.read ? "" : "font-semibold"}>
                  {e.fromName || e.fromEmail}
                </TableCell>
                <TableCell className={e.read ? "text-muted-foreground" : "font-medium"}>
                  {e.subject || "(sem assunto)"}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(e.receivedAt), {
                    addSuffix: true,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {listQuery.data?.totalPage ?? 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= (listQuery.data?.totalPage ?? 1)}
          onClick={() => setPage((p) => p + 1)}
        >
          Próximo
        </Button>
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open: boolean) => !open && setSelected(null)}
      >
        <SheetContent className="sm:max-w-3xl">
          <SheetTitle className="sr-only">E-mail recebido</SheetTitle>
          <SheetDescription className="sr-only">
            Detalhes do e-mail recebido
          </SheetDescription>
          {selected ? <InboundDetails id={selected} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
