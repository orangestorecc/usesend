"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { TextWithCopyButton } from "@usesend/ui/src/text-with-copy";
import { toast } from "@usesend/ui/src/toaster";
import { AlertTriangle, ArrowLeft, Check, RefreshCw, X } from "lucide-react";

import { api } from "~/trpc/react";

/**
 * Configuração de uma região do SES, em página inteira.
 *
 * Era um diálogo com dois campos. Virou página porque aqui também mora a
 * lista de identidades da conta AWS — que não cabe em modal e é o que
 * responde à pergunta que importa: quais domínios estão verificados.
 */
export default function SesConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const settingsQuery = api.admin.getSesSettings.useQuery();
  const setting = settingsQuery.data?.find((s) => s.id === id);

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Configurações SES
      </Link>

      {settingsQuery.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
      ) : !setting ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Configuração não encontrada.
        </p>
      ) : (
        <>
          <h2 className="mt-3 text-xl font-semibold">Região {setting.region}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Limites de envio desta região e os domínios cadastrados na conta
            AWS.
          </p>

          <Limites
            id={setting.id}
            sendRate={setting.sesEmailRateLimit}
            quota={setting.transactionalQuota}
          />

          <Identidades regiao={setting.region} />
        </>
      )}
    </div>
  );
}

function Limites({
  id,
  sendRate,
  quota,
}: {
  id: string;
  sendRate: number;
  quota: number;
}) {
  const [taxa, setTaxa] = useState(String(sendRate));
  const [cota, setCota] = useState(String(quota));

  const utils = api.useUtils();
  const salvar = api.admin.updateSesSettings.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva.");
      utils.admin.getSesSettings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const taxaNum = Number(taxa);
  const cotaNum = Number(cota);
  const invalido =
    !Number.isFinite(taxaNum) ||
    taxaNum <= 0 ||
    !Number.isFinite(cotaNum) ||
    cotaNum < 0 ||
    cotaNum > 100;

  return (
    <div className="mt-6 max-w-xl rounded-lg border p-4">
      <p className="text-sm font-medium">Limites de envio</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Taxa de envio (por segundo)</Label>
          <Input
            value={taxa}
            onChange={(e) => setTaxa(e.target.value)}
            inputMode="decimal"
          />
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Não passe do limite da sua conta na AWS, ou o SES começa a recusar.
          </p>
        </div>
        <div>
          <Label>Cota transacional (%)</Label>
          <Input
            value={cota}
            onChange={(e) => setCota(e.target.value)}
            inputMode="numeric"
          />
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Fatia da taxa reservada para transacional. O resto fica para
            campanha, que pode esperar.
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={() =>
            salvar.mutate({
              settingsId: id,
              sendRate: taxaNum,
              transactionalQuota: cotaNum,
            })
          }
          disabled={invalido || salvar.isPending}
        >
          {salvar.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function Identidades({ regiao }: { regiao: string }) {
  const query = api.consulta.identidadesSes.useQuery({ regiao });
  const dados = query.data;

  const verificadas = dados?.identidades.filter((i) => i.verificada) ?? [];
  const pendentes = dados?.identidades.filter((i) => !i.verificada) ?? [];

  return (
    <div className="mt-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            Domínios e endereços na conta AWS
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Lido direto do SES, não do nosso banco — inclui o que foi criado
            pelo console da AWS.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            className={`mr-1 h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </div>

      {dados ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={dados.producao ? "outline" : "secondary"}>
            {dados.producao ? "conta em produção" : "conta em sandbox"}
          </Badge>
          <Badge variant={dados.envioHabilitado ? "outline" : "destructive"}>
            {dados.envioHabilitado ? "envio habilitado" : "envio desabilitado"}
          </Badge>
          {dados.cotaDiaria ? (
            <Badge variant="secondary">
              {dados.cotaDiaria.toLocaleString("pt-BR")} e-mails / dia
            </Badge>
          ) : null}
          <Badge variant="secondary">
            {verificadas.length} verificado(s) · {pendentes.length} pendente(s)
          </Badge>
        </div>
      ) : null}

      {dados?.erro ? (
        <p className="mt-3 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {dados.erro}
        </p>
      ) : null}

      {dados && !dados.producao && !dados.erro ? (
        <p className="mt-3 flex items-start gap-2 rounded border border-amber-500/50 bg-amber-500/10 p-3 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Em sandbox o SES só entrega para endereços verificados. Peça acesso
            de produção no console da AWS antes de enviar para cliente.
          </span>
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Consultando a AWS…</p>
      ) : dados && dados.identidades.length === 0 && !dados.erro ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum domínio cadastrado nesta região.
        </p>
      ) : dados && dados.identidades.length > 0 ? (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domínio ou endereço</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Verificado</TableHead>
                <TableHead>DKIM</TableHead>
                <TableHead>O que falta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...verificadas, ...pendentes].map((i) => (
                <TableRow key={i.nome}>
                  <TableCell className="font-medium">{i.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.tipo === "DOMAIN" ? "domínio" : "endereço"}
                  </TableCell>
                  <TableCell>
                    {i.verificada ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <Check className="h-3.5 w-3.5" /> sim
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <X className="h-3.5 w-3.5" /> não
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.dkim ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.verificada ? (
                      "—"
                    ) : i.tokensDkim.length > 0 ? (
                      <div className="space-y-1">
                        <p>Publicar 3 CNAMEs no DNS:</p>
                        {i.tokensDkim.map((t) => (
                          <TextWithCopyButton
                            key={t}
                            value={`${t}._domainkey.${i.nome} CNAME ${t}.dkim.amazonses.com`}
                            className="block max-w-[320px] truncate font-mono text-[11px]"
                          />
                        ))}
                      </div>
                    ) : (
                      "Aguardando a AWS gerar os registros"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
