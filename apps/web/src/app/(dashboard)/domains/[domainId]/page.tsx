"use client";

import { api } from "~/trpc/react";
import { DomainStatus } from "@prisma/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@usesend/ui/src/breadcrumb";
import { DomainStatusBadge } from "../domain-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@usesend/ui/src/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { TextWithCopyButton } from "@usesend/ui/src/text-with-copy";
import { DnsInstructionsActions } from "~/components/DnsInstructionsActions";
import { Switch } from "@usesend/ui/src/switch";
import { Button } from "@usesend/ui/src/button";
import React, { use } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { toast } from "@usesend/ui/src/toaster";
import DeleteDomain from "./delete-domain";
import SendTestMail from "./send-test-mail";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import type { DomainDnsRecord } from "~/types/domain";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type DomainResponse = NonNullable<RouterOutputs["domain"]["getDomain"]>;

export default function DomainItemPage({
  params,
}: {
  params: Promise<{ domainId: string }>;
}) {
  const { domainId } = use(params);

  const domainQuery = api.domain.getDomain.useQuery(
    { id: Number(domainId) },
    {
      refetchInterval: (q) => (q?.state.data?.isVerifying ? 10000 : false),
      refetchIntervalInBackground: true,
    },
  );

  const verifyQuery = api.domain.startVerification.useMutation();

  const handleVerify = () => {
    verifyQuery.mutate(
      { id: Number(domainId) },
      {
        onSuccess: () => {
          toast.success(
            "Verificação disparada. Os registros abaixo atualizam em instantes.",
          );
        },
        onError: (e) => toast.error(e.message),
        onSettled: () => domainQuery.refetch(),
      },
    );
  };

  if (domainQuery.isLoading || !domainQuery.data) {
    return <p>Carregando...</p>;
  }

  const domain = domainQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/domains" className="text-lg">
                    Domínios
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-lg" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-lg">
                  {domain.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <DomainStatusBadge status={domain.status} />
        </div>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handleVerify}
            disabled={verifyQuery.isPending || domain.isVerifying}
            className="transition-all hover:border-foreground/40 hover:bg-accent active:scale-[0.98]"
          >
            <RefreshCw
              className={`mr-1.5 h-4 w-4 ${
                verifyQuery.isPending || domain.isVerifying
                  ? "animate-spin"
                  : ""
              }`}
            />
            {verifyQuery.isPending || domain.isVerifying
              ? "Verificando..."
              : domain.status === DomainStatus.SUCCESS
                ? "Verificar novamente"
                : "Verificar domínio"}
          </Button>
          <SendTestMail domain={domain} />
        </div>
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Registros</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-6">
          <RecordsView domain={domain} />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <ConfigView domain={domain} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------- Registros (Records) --------------------------- */

function RecordsView({ domain }: { domain: DomainResponse }) {
  const records = domain.dnsRecords ?? [];
  const verification = records.filter((r) => r.group === "verification");
  const sending = records.filter((r) => r.group === "sending");
  const receiving = records.filter((r) => r.group === "receiving");

  return (
    <div className="flex flex-col gap-6 rounded-lg border p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xl font-semibold">Registros DNS</p>
        <DnsInstructionsActions domainId={domain.id} />
      </div>

      <RecordGroup title="Verificação do domínio" subtitle="DKIM" records={verification} />
      <RecordGroup title="Habilitar envio" subtitle="SPF" records={sending} />
      <ReceivingGroup domain={domain} records={receiving} />
    </div>
  );
}

function RecordGroup({
  title,
  subtitle,
  records,
  action,
}: {
  title: string;
  subtitle?: string;
  records: DomainDnsRecord[];
  action?: React.ReactNode;
}) {
  return (
    <div className="border-t pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{title}</div>
          {subtitle ? (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {action}
      </div>
      {records.length ? <DnsRecordsTable records={records} /> : null}
    </div>
  );
}

function ReceivingGroup({
  domain,
  records,
}: {
  domain: DomainResponse;
  records: DomainDnsRecord[];
}) {
  const utils = api.useUtils();
  const [receiving, setReceiving] = React.useState(domain.receivingEnabled);
  const mutation = api.domain.setReceiving.useMutation();

  function toggle() {
    const next = !receiving;
    setReceiving(next);
    mutation.mutate(
      { id: domain.id, enabled: next },
      {
        onSuccess: () => {
          utils.domain.invalidate();
          toast.success(
            next
              ? "Recebimento ativado. Adicione o registro MX abaixo no seu DNS."
              : "Recebimento desativado.",
          );
        },
        onError: (e) => {
          setReceiving(!next);
          toast.error(e.message);
        },
      },
    );
  }

  return (
    <div className="border-t pt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Habilitar recebimento</div>
          <div className="text-sm text-muted-foreground">
            Receba e-mails enviados para este domínio (chegam em E-mails →
            Recebidos).
          </div>
        </div>
        <Switch
          checked={receiving}
          onCheckedChange={toggle}
          disabled={mutation.isPending}
          className="data-[state=checked]:bg-success"
        />
      </div>
      {receiving && records.length ? (
        <DnsRecordsTable records={records} />
      ) : receiving ? null : (
        <p className="mt-3 text-sm text-muted-foreground">
          Ative para receber e-mails neste domínio.
        </p>
      )}
    </div>
  );
}

function DnsRecordsTable({ records }: { records: DomainDnsRecord[] }) {
  return (
    <Table className="mt-3">
      <TableHeader>
        <TableRow>
          <TableHead className="rounded-tl-xl">Tipo</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Conteúdo</TableHead>
          <TableHead>TTL</TableHead>
          <TableHead>Prioridade</TableHead>
          <TableHead className="rounded-tr-xl">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => {
          const key = `${record.type}-${record.name}-${record.value.slice(0, 8)}`;
          const valueClassName = record.name.includes("_domainkey")
            ? "w-[200px] overflow-hidden text-ellipsis"
            : "w-[200px] overflow-hidden text-ellipsis text-nowrap";
          return (
            <TableRow key={key}>
              <TableCell>{record.type}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {record.recommended ? (
                    <span className="text-sm text-muted-foreground">
                      (recomendado)
                    </span>
                  ) : null}
                  <TextWithCopyButton value={record.name} />
                </div>
              </TableCell>
              <TableCell>
                <TextWithCopyButton
                  value={record.value}
                  className={valueClassName}
                />
              </TableCell>
              <TableCell>{record.ttl}</TableCell>
              <TableCell>{record.priority ?? ""}</TableCell>
              <TableCell>
                <DnsVerificationStatus status={record.status} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* --------------------------- Configuração (Config) ------------------------- */

function ConfigView({ domain }: { domain: DomainResponse }) {
  const updateDomain = api.domain.updateDomain.useMutation();
  const utils = api.useUtils();

  const [clickTracking, setClickTracking] = React.useState(domain.clickTracking);
  const [openTracking, setOpenTracking] = React.useState(domain.openTracking);
  const [tls, setTls] = React.useState(domain.tlsEnforced ? "enforced" : "opportunistic");

  const save = (data: Parameters<typeof updateDomain.mutate>[0], msg: string) =>
    updateDomain.mutate(data, {
      onSuccess: () => {
        utils.domain.invalidate();
        toast.success(msg);
      },
    });

  return (
    <div className="flex flex-col gap-6 rounded-lg border p-6 shadow-sm">
      <p className="text-xl font-semibold">Configuração</p>

      <div className="flex flex-col gap-1">
        <div className="font-semibold">Rastreamento de cliques</div>
        <p className="text-sm text-muted-foreground">
          Rastreie qualquer link no conteúdo dos seus e-mails. Ao clicar, o
          destinatário é redirecionado imediatamente ao destino original.
        </p>
        <Switch
          checked={clickTracking}
          onCheckedChange={() => {
            const v = !clickTracking;
            setClickTracking(v);
            save(
              { id: domain.id, clickTracking: v },
              "Rastreamento de cliques atualizado",
            );
          }}
          className="data-[state=checked]:bg-success"
        />
      </div>

      <div className="flex flex-col gap-1 border-t pt-6">
        <div className="font-semibold">Rastreamento de aberturas</div>
        <p className="text-sm text-muted-foreground">
          Um pixel transparente 1×1 é inserido em cada e-mail para saber quantas
          pessoas abrem. Pode gerar resultados imprecisos e afetar a entrega.
        </p>
        <Switch
          checked={openTracking}
          onCheckedChange={() => {
            const v = !openTracking;
            setOpenTracking(v);
            save(
              { id: domain.id, openTracking: v },
              "Rastreamento de aberturas atualizado",
            );
          }}
          className="data-[state=checked]:bg-success"
        />
      </div>

      <div className="flex flex-col gap-2 border-t pt-6">
        <div className="font-semibold">TLS (Transport Layer Security)</div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          &quot;Oportunista&quot; tenta sempre uma conexão segura com o servidor
          de destino; se não conseguir, envia sem criptografia.
          &quot;Obrigatório&quot; exige que a comunicação use TLS de qualquer
          forma.
        </p>
        <Select
          value={tls}
          onValueChange={(v) => {
            setTls(v);
            save(
              { id: domain.id, tlsEnforced: v === "enforced" },
              "Política TLS atualizada",
            );
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="opportunistic">Oportunista</SelectItem>
            <SelectItem value="enforced">Obrigatório</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2 border-t pt-6">
        <p className="text-lg font-semibold text-destructive">Perigo</p>
        <p className="text-sm font-semibold text-destructive">
          Excluir um domínio interromperá o envio e o recebimento de e-mails com
          este domínio.
        </p>
        <DeleteDomain domain={domain} />
      </div>
    </div>
  );
}

const DnsVerificationStatus: React.FC<{ status: DomainStatus }> = ({ status }) => {
  let badgeColor = "bg-gray/10 text-gray border-gray/10";
  switch (status) {
    case DomainStatus.SUCCESS:
      badgeColor = "bg-green/15 text-green border border-green/25";
      break;
    case DomainStatus.FAILED:
      badgeColor = "bg-red/10 text-red border border-red/10";
      break;
    case DomainStatus.TEMPORARY_FAILURE:
    case DomainStatus.PENDING:
      badgeColor = "bg-yellow/20 text-yellow border border-yellow/10";
      break;
    default:
      badgeColor = "bg-gray/10 text-gray border border-gray/20";
  }
  return (
    <div
      className={`flex min-w-[70px] items-center justify-center rounded-md py-1 text-center text-xs capitalize ${badgeColor}`}
    >
      {status.split("_").join(" ").toLowerCase()}
    </div>
  );
};
