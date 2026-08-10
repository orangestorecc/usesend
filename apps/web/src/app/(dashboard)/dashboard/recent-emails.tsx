"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { formatDate } from "date-fns";
import { api } from "~/trpc/react";
import { Button } from "@usesend/ui/src/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { EmailStatusBadge } from "../emails/email-status-badge";
import { EmptyState } from "~/components/EmptyState";
import { TableRowsSkeleton } from "~/components/skeletons";

export function RecentEmails() {
  const emailsQuery = api.email.emails.useQuery({ page: 1 });
  const emails = emailsQuery.data?.emails?.slice(0, 6) ?? [];

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">
            E-mails recentes
          </h3>
          <p className="text-xs text-muted-foreground">últimos envios</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/emails">Ver todos</Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Destinatário</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assunto</TableHead>
            <TableHead className="text-right">Enviado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emailsQuery.isLoading ? (
            <TableRowsSkeleton rows={5} cols={4} />
          ) : emails.length ? (
            emails.map((email) => (
              <TableRow key={email.id}>
                <TableCell className="font-medium">{email.to}</TableCell>
                <TableCell>
                  <EmailStatusBadge status={email.latestStatus ?? "SENT"} />
                </TableCell>
                <TableCell>
                  <div className="max-w-xs truncate text-muted-foreground">
                    {email.subject}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {formatDate(
                    new Date(email.scheduledAt ?? email.createdAt),
                    "dd/MM HH:mm",
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="p-0">
                <EmptyState
                  icon={Mail}
                  title="Nenhum e-mail ainda"
                  description="Os e-mails enviados aparecerão aqui."
                  className="border-0 bg-transparent"
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
