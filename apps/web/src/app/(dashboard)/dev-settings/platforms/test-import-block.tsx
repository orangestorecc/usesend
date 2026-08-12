"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { Badge } from "@usesend/ui/src/badge";
import { toast } from "@usesend/ui/src/toaster";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { api } from "~/trpc/react";

/**
 * Simulação de importação: cria uma lista de teste e importa um único contato
 * pelo mesmo caminho da sincronização real, para o cliente ver com os próprios
 * olhos o que acontece com o double opt-in antes de ligar a integração.
 */
export default function TestImportBlock({
  baseUrl,
  apiKey,
  subscribeMode,
  doubleOptInEnabled,
  defaultEmail,
}: {
  baseUrl: string;
  apiKey: string;
  subscribeMode: string;
  doubleOptInEnabled: boolean;
  defaultEmail?: string;
}) {
  const [destino, setDestino] = useState(defaultEmail ?? "");
  const mutation = api.platformIntegration.testImport.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const r = mutation.data;

  const alertaVermelho = r?.veredito.startsWith("ATENÇÃO");

  return (
    <div className="rounded-lg border border-dashed p-3">
      <Label className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4" />
        Testar importação (simulação)
      </Label>

      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Lê <strong>um</strong> cliente real da sua loja, cria uma lista chamada
        &quot;[Teste] Integração&quot; e importa esse único contato pelo mesmo
        caminho da sincronização de verdade. Serve para você conferir, antes de
        ligar a integração, se o double opt-in se comporta como espera.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        O contato é criado com o <strong>e-mail de teste abaixo</strong>, não
        com o e-mail do cliente da loja — assim, se houver disparo de
        confirmação, ele chega em você e não num cliente real. O resto dos dados
        (nome, telefone, newsletter) vem do cliente de verdade, para você
        conferir o mapeamento.
      </p>

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">E-mail de teste</Label>
          <Input
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="voce@suaempresa.com.br"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            mutation.mutate({
              baseUrl,
              apiKey,
              subscribeMode: subscribeMode as "newsletter" | "all" | "none",
              doubleOptInEnabled,
              destinationEmail: destino,
            })
          }
          disabled={!baseUrl || !apiKey || !destino || mutation.isPending}
        >
          {mutation.isPending ? "Testando..." : "Rodar teste"}
        </Button>
      </div>

      {r ? (
        <div className="mt-4 space-y-3 border-t pt-3 text-xs">
          <Linha
            ok={true}
            titulo="Lista de teste criada"
            detalhe={r.contactBookName}
            href={`/contacts/${r.contactBookId}`}
            hrefLabel="abrir lista"
          />

          <Linha
            ok={r.contato !== null}
            titulo={r.contato ? "Contato criado" : "Nenhum contato criado"}
            detalhe={
              r.contato
                ? `${r.contato.email} — ${
                    r.contato.subscribed ? "inscrito" : "não inscrito"
                  }`
                : undefined
            }
          />

          <div className="flex items-start gap-2">
            <Badge variant={r.doubleOptInEnabled ? "outline" : "secondary"}>
              double opt-in {r.doubleOptInEnabled ? "ligado" : "desligado"}
            </Badge>
          </div>

          <Linha
            ok={r.email !== null}
            titulo={
              r.email
                ? "E-mail de confirmação gerado"
                : "Nenhum e-mail foi gerado"
            }
            detalhe={
              r.email
                ? `"${r.email.subject}" para ${r.email.to.join(", ")} — ${r.email.status}`
                : undefined
            }
            href={r.email ? `/emails/${r.email.id}` : undefined}
            hrefLabel="ver e-mail e entregas"
          />

          {r.amostra ? (
            <div className="rounded border bg-muted/40 p-2">
              <p className="font-medium">Cliente lido da loja</p>
              <p className="mt-1 text-muted-foreground">
                {r.amostra.firstName} {r.amostra.lastName} ·{" "}
                {r.amostra.email ?? "sem e-mail"} · newsletter na loja:{" "}
                {r.amostra.newsletterNaLoja ? "sim" : "não"}
              </p>
              {Object.keys(r.amostra.propriedades).length ? (
                <p className="mt-1 text-muted-foreground">
                  {Object.entries(r.amostra.propriedades)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <p
            className={
              alertaVermelho
                ? "rounded border border-destructive/50 bg-destructive/10 p-2 font-medium text-destructive"
                : "rounded border bg-muted/40 p-2 leading-relaxed"
            }
          >
            {r.veredito}
          </p>

          <p className="text-muted-foreground">
            Terminou de conferir? Apague a lista de teste em Contatos — ela não
            é removida sozinha.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Linha({
  ok,
  titulo,
  detalhe,
  href,
  hrefLabel,
}: {
  ok: boolean;
  titulo: string;
  detalhe?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div>
        <span className="font-medium">{titulo}</span>
        {detalhe ? (
          <span className="text-muted-foreground"> — {detalhe}</span>
        ) : null}
        {href ? (
          <>
            {" "}
            <Link href={href} target="_blank" className="underline">
              {hrefLabel}
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
