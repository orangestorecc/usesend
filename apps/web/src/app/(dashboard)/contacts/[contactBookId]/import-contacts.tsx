"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import { Button } from "@usesend/ui/src/button";
import { Label } from "@usesend/ui/src/label";
import { Input } from "@usesend/ui/src/input";
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
import {
  AlertTriangle,
  Check,
  Download,
  Info,
  Upload,
  X,
} from "lucide-react";

import { api } from "~/trpc/react";
import {
  analisarArquivo,
  aplicarMapeamento,
  mapearAutomaticamente,
  type ArquivoAnalisado,
  type DestinoColuna,
  type Mapeamento,
} from "~/lib/contact-import/parse";

type Passo = "explicacao" | "mapeamento" | "importando";

const DESTINOS: { valor: DestinoColuna; rotulo: string }[] = [
  { valor: "email", rotulo: "E-mail" },
  { valor: "firstName", rotulo: "Nome" },
  { valor: "lastName", rotulo: "Sobrenome" },
  { valor: "subscribed", rotulo: "Inscrito" },
  { valor: "ignore", rotulo: "Ignorar esta coluna" },
];

export default function ImportContacts({
  contactBookId,
  contactBookVariables,
  doubleOptInEnabled,
  trigger,
  open: openControlado,
  onOpenChange,
}: {
  contactBookId: string;
  contactBookVariables?: string[];
  doubleOptInEnabled?: boolean;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (aberto: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openControlado ?? openInterno;
  const setOpen = (aberto: boolean) => {
    if (openControlado === undefined) setOpenInterno(aberto);
    else onOpenChange?.(aberto);
  };
  const [passo, setPasso] = useState<Passo>("explicacao");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisado, setAnalisado] = useState<ArquivoAnalisado | null>(null);
  const [mapeamento, setMapeamento] = useState<Mapeamento>({});
  const [enviando, setEnviando] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();
  const dominiosQuery = api.domain.domains.useQuery(undefined, {
    enabled: doubleOptInEnabled === true,
  });
  const progressoQuery = api.contactImport.get.useQuery(
    { id: importId ?? "" },
    {
      enabled: !!importId,
      refetchInterval: (q) =>
        q.state.data?.status === "processing" ? 1500 : false,
    },
  );

  const temDominioVerificado = (dominiosQuery.data ?? []).some(
    (d) => d.status === "SUCCESS",
  );

  const resultado = useMemo(
    () => (analisado ? aplicarMapeamento(analisado, mapeamento) : null),
    [analisado, mapeamento],
  );

  const temColunaEmail = Object.values(mapeamento).includes("email");

  function limpar() {
    setPasso("explicacao");
    setArquivo(null);
    setAnalisado(null);
    setMapeamento({});
    setEnviando(false);
    setImportId(null);
  }

  function receberArquivo(f: File) {
    if (!/\.(csv|txt)$/i.test(f.name)) {
      toast.error("Envie um arquivo .csv ou .txt");
      return;
    }
    const leitor = new FileReader();
    leitor.onload = (e) => {
      const texto = String(e.target?.result ?? "");
      const parsed = analisarArquivo(texto);
      if (parsed.linhas.length === 0) {
        toast.error("O arquivo está vazio");
        return;
      }
      setArquivo(f);
      setAnalisado(parsed);
      setMapeamento(
        mapearAutomaticamente(parsed.cabecalhos, contactBookVariables ?? []),
      );
      setPasso("mapeamento");
    };
    leitor.readAsText(f, "utf-8");
  }

  async function importar() {
    if (!arquivo || !resultado) return;
    setEnviando(true);

    const dados = new FormData();
    dados.append("file", arquivo);
    dados.append("contactBookId", contactBookId);
    dados.append("mapping", JSON.stringify(mapeamento));

    try {
      const resposta = await fetch("/api/contact-import/upload", {
        method: "POST",
        body: dados,
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        throw new Error(corpo.error ?? "Falha ao importar");
      }
      setImportId(corpo.importId);
      setPasso("importando");
      utils.contactImport.list.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setEnviando(false);
    }
  }

  function fechar() {
    utils.contacts.contacts.invalidate();
    utils.contacts.getContactBookDetails.invalidate();
    utils.contactImport.list.invalidate();
    limpar();
    setOpen(false);
  }

  const progresso = progressoQuery.data;
  const pct =
    progresso && progresso.total > 0
      ? Math.min(100, Math.round((progresso.processed / progresso.total) * 100))
      : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        setOpen(aberto);
        if (!aberto) limpar();
      }}
    >
      {openControlado === undefined ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline">
              <Upload className="mr-1 h-4 w-4" />
              Importar contatos
            </Button>
          )}
        </DialogTrigger>
      ) : null}

      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            {passo === "explicacao"
              ? "Suba uma planilha e escolha o que cada coluna significa."
              : passo === "mapeamento"
                ? "Confira o que cada coluna do arquivo vai virar."
                : "Importação em andamento."}
          </DialogDescription>
        </DialogHeader>

        {passo === "explicacao" ? (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p>
                  O arquivo precisa ter uma coluna com o e-mail. Nome,
                  sobrenome, se a pessoa é inscrita e qualquer outra coluna são
                  opcionais — as demais viram propriedades do contato, que você
                  pode usar nos e-mails.
                </p>
                <p className="mt-2">
                  Aceitamos <strong>.csv</strong> e <strong>.txt</strong>. Se
                  você usa Excel, salve como &quot;CSV UTF-8&quot;. Até 10 MB e
                  50.000 linhas.
                </p>
              </div>
            </div>

            <div>
              <a
                href="/api/contact-import/modelo"
                className="inline-flex items-center gap-2 text-sm underline"
              >
                <Download className="h-4 w-4" />
                Baixar planilha de exemplo
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                Abre direto no Excel, já com as colunas separadas e três linhas
                de exemplo para você substituir.
              </p>
            </div>

            {doubleOptInEnabled ? (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Esta lista está com double opt-in ligado
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {temDominioVerificado
                    ? "Cada contato importado vai receber um e-mail pedindo confirmação, e só passa a receber suas campanhas depois de clicar no link. Numa importação grande, isso é muito e-mail de uma vez."
                    : "Você ainda não tem domínio verificado, então nenhum e-mail de confirmação vai sair e todos os contatos vão ficar como Pendentes — sem receber campanhas. Verifique um domínio antes, ou desligue o double opt-in desta lista."}
                </p>
              </div>
            ) : null}

            <div
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                arrastando ? "border-primary bg-primary/5" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                const f = e.dataTransfer.files[0];
                if (f) receberArquivo(f);
              }}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => inputRef.current?.click()}
              >
                Escolher arquivo
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) receberArquivo(f);
                }}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                ou arraste o arquivo aqui
              </p>
            </div>
          </div>
        ) : null}

        {passo === "mapeamento" && analisado && resultado ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {arquivo?.name} · {analisado.linhas.length} linhas
              {analisado.semCabecalho
                ? " · o arquivo não tem cabeçalho, então as colunas estão numeradas"
                : null}
            </p>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coluna no arquivo</TableHead>
                    <TableHead>Primeiro valor</TableHead>
                    <TableHead className="w-[260px]">Importar como</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analisado.cabecalhos.map((cabecalho, i) => {
                    const destino = mapeamento[cabecalho] ?? "ignore";
                    const ehPropriedade = destino.startsWith("prop:");
                    return (
                      <TableRow key={`${cabecalho}-${i}`}>
                        <TableCell className="font-medium">
                          {cabecalho}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-muted-foreground">
                          {analisado.linhas[0]?.[i] || "—"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ehPropriedade ? "prop" : destino}
                            onValueChange={(v) =>
                              setMapeamento((m) => ({
                                ...m,
                                [cabecalho]:
                                  v === "prop"
                                    ? (`prop:${cabecalho.trim()}` as DestinoColuna)
                                    : (v as DestinoColuna),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DESTINOS.map((d) => (
                                <SelectItem key={d.valor} value={d.valor}>
                                  {d.rotulo}
                                </SelectItem>
                              ))}
                              <SelectItem value="prop">
                                Propriedade personalizada
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {ehPropriedade ? (
                            <Input
                              className="mt-1"
                              value={destino.slice(5)}
                              onChange={(e) =>
                                setMapeamento((m) => ({
                                  ...m,
                                  [cabecalho]:
                                    `prop:${e.target.value}` as DestinoColuna,
                                }))
                              }
                              placeholder="nome da propriedade"
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {!temColunaEmail ? (
              <p className="rounded border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                Escolha qual coluna tem o e-mail. Sem isso não dá para importar.
              </p>
            ) : (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  {resultado.validos} contatos serão importados
                </p>
                <p className="mt-1 text-muted-foreground">
                  {resultado.invalidos} ignorados por e-mail inválido ou vazio ·{" "}
                  {resultado.duplicados} repetidos dentro do arquivo
                </p>
              </div>
            )}

            {temColunaEmail ? (
              <div>
                <Label className="text-xs">
                  Prévia das 10 primeiras linhas
                </Label>
                <div className="mt-1 max-h-[240px] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Sobrenome</TableHead>
                        <TableHead>Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultado.contatos.slice(0, 10).map((c, i) => (
                        <TableRow key={`${c.email}-${i}`}>
                          <TableCell className="font-mono text-xs">
                            {c.email || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {c.firstName ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {c.lastName ?? "—"}
                          </TableCell>
                          <TableCell>
                            {c.problema ? (
                              <span className="flex items-center gap-1 text-xs text-destructive">
                                <X className="h-3 w-3" />
                                {c.problema === "duplicado"
                                  ? "repetido"
                                  : "e-mail inválido"}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-emerald-600">
                                <Check className="h-3 w-3" />
                                ok
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {passo === "importando" ? (
          <div className="space-y-4 py-2">
            <div>
              <div className="flex justify-between text-sm">
                <span>
                  {progresso?.status === "done"
                    ? "Importação concluída"
                    : `Importando ${progresso?.processed ?? 0} de ${progresso?.total ?? 0}…`}
                </span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {progresso?.status === "done" ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p>
                  {progresso.created} criados · {progresso.updated} atualizados
                  · {progresso.skipped} ignorados
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O arquivo ficou guardado e pode ser baixado no histórico de
                  importações.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pode fechar esta janela — a importação continua rodando e o
                progresso fica no histórico.
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          {passo === "mapeamento" ? (
            <>
              <Button variant="outline" onClick={() => limpar()}>
                Trocar arquivo
              </Button>
              <Button
                onClick={importar}
                disabled={!temColunaEmail || enviando || !resultado?.validos}
              >
                {enviando
                  ? "Enviando..."
                  : `Importar ${resultado?.validos ?? 0} contatos`}
              </Button>
            </>
          ) : passo === "importando" ? (
            <Button onClick={fechar}>
              {progresso?.status === "done" ? "Concluir" : "Fechar"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
