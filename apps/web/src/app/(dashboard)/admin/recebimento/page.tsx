"use client";

import Link from "next/link";
import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { toast } from "@usesend/ui/src/toaster";
import {
  CheckCircle2Icon,
  XCircleIcon,
  RefreshCwIcon,
  InboxIcon,
} from "lucide-react";
import { api } from "~/trpc/react";

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      )}
      <span className={ok ? "" : "text-destructive"}>{children}</span>
    </div>
  );
}

export default function AdminRecebimentoPage() {
  const utils = api.useUtils();
  const status = api.inboundAdmin.status.useQuery();
  const recentes = api.inboundAdmin.recentes.useQuery({ limit: 10 });

  const poll = api.inboundAdmin.pollAgora.useMutation({
    onSuccess: ({ novos }) => {
      utils.inboundAdmin.status.invalidate();
      utils.inboundAdmin.recentes.invalidate();
      toast.success(
        novos > 0
          ? `${novos} e-mail(s) novo(s) processado(s).`
          : "Nenhum e-mail novo na caixa.",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const d = status.data;

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm text-muted-foreground">
        O recebimento usa o SES para entregar os e-mails num bucket S3, e um
        job lê esse bucket a cada minuto. Aqui você confere se essa engrenagem
        está de pé.
      </p>

      {/* ---------------------------------------------------- Estado */}
      <div className="rounded-xl border shadow-sm">
        <div className="flex items-center justify-between border-b p-6">
          <div>
            <h2 className="text-base font-semibold">Estado do serviço</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Todas as condições precisam estar verdes para receber e-mail.
            </p>
          </div>
          {d ? (
            <Badge variant={d.jobAtivo ? "outline" : "destructive"}>
              {d.jobAtivo ? "ativo" : "inativo"}
            </Badge>
          ) : null}
        </div>

        {status.isLoading ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">Carregando…</p>
        ) : d ? (
          <div className="space-y-3 p-6">
            <Check ok={Boolean(d.bucket)}>
              {d.bucket ? (
                <>
                  Bucket S3: <span className="font-mono">{d.bucket}</span>
                </>
              ) : (
                <>
                  <strong>INBOUND_S3_BUCKET não está definida.</strong> Sem
                  ela o job de leitura nem inicia — o recebimento fica
                  desligado silenciosamente.
                </>
              )}
            </Check>

            <Check ok={d.regiaoCorreta}>
              Região: <span className="font-mono">{d.region}</span>
              {d.regiaoCorreta ? null : (
                <>
                  {" "}
                  — o recebimento do SES <strong>só existe em us-east-1</strong>,
                  independente da região usada para enviar.
                </>
              )}
            </Check>

            <Check ok={d.hasRedis}>
              Redis {d.hasRedis ? "conectado" : "ausente — o job não roda sem ele"}
            </Check>

            <Check ok={d.hasAws}>
              Credenciais da AWS {d.hasAws ? "configuradas" : "ausentes"}
            </Check>

            <div className="flex flex-wrap items-center gap-6 border-t pt-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Recebidos</div>
                <div className="font-mono text-lg">{d.total}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Últimas 24 h
                </div>
                <div className="font-mono text-lg">{d.desde24h}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Último</div>
                <div className="text-sm">
                  {d.ultimo
                    ? new Date(d.ultimo.receivedAt).toLocaleString("pt-BR")
                    : "nenhum ainda"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={!d.jobAtivo || poll.isPending}
                onClick={() => poll.mutate()}
              >
                <RefreshCwIcon
                  className={`mr-1.5 h-4 w-4 ${poll.isPending ? "animate-spin" : ""}`}
                />
                {poll.isPending ? "Verificando…" : "Verificar agora"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------- Domínios */}
      <div className="rounded-xl border shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-base font-semibold">Domínios com recebimento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O recebimento é ligado por domínio, na aba Configuração de cada um.
          </p>
        </div>
        {d?.dominios.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domínio</TableHead>
                <TableHead>Verificação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.dominios.map((dom) => (
                <TableRow key={dom.id}>
                  <TableCell className="font-mono text-sm">
                    {dom.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={dom.status === "SUCCESS" ? "outline" : "destructive"}
                    >
                      {dom.status === "SUCCESS" ? "verificado" : dom.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/domains/${dom.id}`}
                      className="text-xs underline"
                    >
                      abrir
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-6 py-8 text-sm text-muted-foreground">
            Nenhum domínio com recebimento ligado. Abra um domínio verificado e
            ative na aba Configuração.
          </div>
        )}
      </div>

      {/* -------------------------------------------------- Recentes */}
      <div className="rounded-xl border shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-base font-semibold">Últimos recebidos</h2>
        </div>
        {recentes.data?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>De</TableHead>
                <TableHead>Assunto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentes.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(e.receivedAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm">{e.teamName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.fromEmail}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-sm">
                    {e.subject ?? "(sem assunto)"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <InboxIcon className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum e-mail recebido ainda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
