"use client";

import { useState } from "react";
import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { AlertTriangle, Check, ExternalLink, X } from "lucide-react";

import { api } from "~/trpc/react";
import { formatarDocumento } from "~/lib/validadores-br";

/**
 * Integração de consulta de CNPJ (ReceitaWS).
 *
 * Não guarda credencial no banco: o token vem do ambiente, como os outros
 * segredos de infraestrutura. Esta tela serve para ver se está configurado e
 * para testar de verdade, que é o que interessa saber antes de um cliente
 * descobrir sozinho que não funciona.
 */
export default function ReceitaPage() {
  const [cnpj, setCnpj] = useState("");
  const statusQuery = api.consulta.statusReceitaWs.useQuery();
  const teste = api.consulta.testarReceitaWs.useMutation();

  const configurado = statusQuery.data?.tokenConfigurado;

  return (
    <div>
      <h2 className="text-base font-semibold">Consulta de CNPJ (ReceitaWS)</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Usada no cadastro do responsável financeiro: com o CNPJ, o cliente
        recebe razão social, nome fantasia e endereço preenchidos, em vez de
        digitar tudo à mão.
      </p>

      <div className="mt-6 max-w-2xl rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Token da API</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Variável <code>RECEITAWS_API_TOKEN</code> no ambiente do servidor.
            </p>
          </div>
          {statusQuery.isLoading ? (
            <Badge variant="secondary">verificando…</Badge>
          ) : configurado ? (
            <Badge variant="outline">configurado</Badge>
          ) : (
            <Badge variant="secondary">não configurado</Badge>
          )}
        </div>

        {!statusQuery.isLoading && !configurado ? (
          <div className="mt-3 rounded border border-amber-500/50 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Rodando no plano gratuito
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Sem token a consulta funciona, mas o limite é de{" "}
              <strong>3 consultas por minuto por IP</strong> — como o servidor
              é um só, esse limite é do sistema inteiro, não de cada cliente.
              Serve para testar; não serve para operar.
            </p>
          </div>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">
          Para configurar, adicione a linha abaixo no{" "}
          <code>apps/web/.env</code> do servidor e reinicie o app:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
          RECEITAWS_API_TOKEN=seu-token-aqui
        </pre>

        <a
          href="https://receitaws.com.br/account/api"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs underline"
        >
          Painel da ReceitaWS
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-6 max-w-2xl rounded-lg border p-4">
        <p className="text-sm font-medium">Testar consulta</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Faz uma consulta real e mostra o que voltou.
        </p>

        <div className="mt-3 flex gap-2">
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(formatarDocumento(e.target.value))}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => teste.mutate({ cnpj })}
            disabled={cnpj.replace(/\D/g, "").length !== 14 || teste.isPending}
          >
            {teste.isPending ? "Consultando..." : "Consultar"}
          </Button>
        </div>

        {teste.data ? (
          <div className="mt-3 rounded border p-3 text-sm">
            {teste.data.ok ? (
              <>
                <p className="flex items-center gap-2 font-medium">
                  <Check className="h-4 w-4 text-emerald-600" />
                  {teste.data.razaoSocial}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Situação: {teste.data.situacao ?? "—"} · {teste.data.cidade}/
                  {teste.data.uf} · respondeu em {teste.data.duracaoMs} ms
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-medium text-destructive">
                  <X className="h-4 w-4" />
                  Falhou
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {teste.data.erro} · {teste.data.duracaoMs} ms
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-6 max-w-2xl rounded-lg border p-4">
        <p className="text-sm font-medium">Consulta de CEP</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          O endereço é completado pelo <strong>ViaCEP</strong>, que não exige
          credencial nem cadastro. Não há nada para configurar aqui. A
          alternativa oficial do gov.br passa por gateway com credenciamento —
          mais burocracia do que vale para preencher três campos.
        </p>
      </div>
    </div>
  );
}
