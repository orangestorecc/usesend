"use client";

import { Domain, DomainStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { api } from "~/trpc/react";
import React from "react";
import { DomainStatusBadge } from "./domain-badge";
import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@usesend/ui/src/dropdown-menu";
import {
  Check,
  Eye,
  Globe,
  Inbox,
  MoreHorizontal,
  MousePointerClick,
  Settings2,
  Trash2,
} from "lucide-react";
import { EmptyState } from "~/components/EmptyState";
import { CardsSkeleton } from "~/components/skeletons";
import DeleteDomain from "./delete-domain";

export default function DomainsList() {
  const domainsQuery = api.domain.domains.useQuery();

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-4">
        {domainsQuery.isLoading ? (
          <CardsSkeleton count={3} />
        ) : domainsQuery.data?.length ? (
          domainsQuery.data?.map((domain) => (
            <DomainItem key={domain.id} domain={domain} />
          ))
        ) : (
          <EmptyState
            icon={Globe}
            title="Nenhum domínio adicionado"
            description="Adicione e verifique um domínio para começar a enviar e-mails."
          />
        )}
      </div>
    </div>
  );
}

const statusDot: Record<DomainStatus, string> = {
  SUCCESS: "bg-green",
  FAILED: "bg-red",
  PENDING: "bg-yellow",
  TEMPORARY_FAILURE: "bg-yellow",
  NOT_STARTED: "bg-gray",
};

const DomainItem: React.FC<{ domain: Domain }> = ({ domain }) => {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const verified = domain.status === DomainStatus.SUCCESS;

  return (
    <div className="rounded-lg border shadow-sm transition-colors hover:border-foreground/20">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${statusDot[domain.status] ?? "bg-gray"}`}
              aria-hidden
            />
            <Link
              href={`/domains/${domain.id}`}
              className="truncate text-lg font-medium hover:underline hover:underline-offset-4"
            >
              {domain.name}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DomainStatusBadge status={domain.status} />
            {domain.receivingEnabled ? (
              <Badge variant="outline" className="gap-1">
                <Inbox className="h-3 w-3" />
                Recebendo
              </Badge>
            ) : null}
            <TrackingChip
              label="Cliques"
              active={domain.clickTracking}
              icon={MousePointerClick}
            />
            <TrackingChip
              label="Aberturas"
              active={domain.openTracking}
              icon={Eye}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {domain.region} · criado{" "}
            {formatDistanceToNow(new Date(domain.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {verified ? null : (
            <Button asChild variant="outline" size="sm">
              <Link href={`/domains/${domain.id}`}>Configurar DNS</Link>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label={`Ações do domínio ${domain.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href={`/domains/${domain.id}`}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Configurações e registros
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir domínio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DeleteDomain
        domain={domain}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        redirectOnDelete={false}
      />
    </div>
  );
};

const TrackingChip: React.FC<{
  label: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ label, active, icon: Icon }) => (
  <span
    title={
      active
        ? `Rastreamento de ${label.toLowerCase()} ativo`
        : `Rastreamento de ${label.toLowerCase()} desativado`
    }
    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
      active
        ? "border-green/25 bg-green/15 text-green"
        : "border-border text-muted-foreground"
    }`}
  >
    <Icon className="h-3 w-3" />
    {label}
    {active ? <Check className="h-3 w-3" /> : null}
  </span>
);
