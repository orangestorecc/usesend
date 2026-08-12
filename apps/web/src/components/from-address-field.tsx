"use client";

import { useEffect, useState } from "react";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";

import {
  cabeNosCamposGuiados,
  compor,
  decompor,
  validarCaixa,
  validarNomeExibicao,
} from "~/lib/from-address";

/**
 * Campo de remetente em três partes: nome de exibição, caixa e domínio.
 *
 * Existe porque o campo único de texto livre deixava a pessoa digitar
 * qualquer coisa e só descobrir no envio, com um "e-mail de remetente
 * inválido" que não ensina nada.
 *
 * O valor para fora continua sendo uma string só — quem consome não muda.
 */
export default function FromAddressField({
  value,
  onChange,
  dominiosVerificados,
  disabled,
  label = "De",
}: {
  value: string;
  onChange: (valor: string) => void;
  dominiosVerificados: string[];
  disabled?: boolean;
  label?: string;
}) {
  const inicial = decompor(value);
  const cabe = cabeNosCamposGuiados(value, dominiosVerificados);

  // Valor herdado que não encaixa nos campos guiados fica em texto livre em
  // vez de ser reescrito por baixo dos panos.
  const [avancado, setAvancado] = useState(!!value && !cabe);
  const [nomeExibicao, setNomeExibicao] = useState(inicial?.nomeExibicao ?? "");
  const [caixa, setCaixa] = useState(inicial?.caixa ?? "");
  const [dominio, setDominio] = useState(
    inicial?.dominio ?? dominiosVerificados[0] ?? "",
  );

  // Com um domínio só, já vem escolhido — não faz sentido obrigar o clique.
  useEffect(() => {
    if (!dominio && dominiosVerificados.length > 0) {
      setDominio(dominiosVerificados[0]!);
    }
  }, [dominio, dominiosVerificados]);

  const erroCaixa = caixa ? validarCaixa(caixa) : null;
  const erroNome = validarNomeExibicao(nomeExibicao);

  function emitir(proximo: {
    nomeExibicao?: string;
    caixa?: string;
    dominio?: string;
  }) {
    const partes = {
      nomeExibicao: proximo.nomeExibicao ?? nomeExibicao,
      caixa: proximo.caixa ?? caixa,
      dominio: proximo.dominio ?? dominio,
    };
    if (!partes.caixa || !partes.dominio) {
      onChange("");
      return;
    }
    if (validarCaixa(partes.caixa) || validarNomeExibicao(partes.nomeExibicao)) {
      onChange("");
      return;
    }
    onChange(compor(partes));
  }

  if (avancado) {
    return (
      <div>
        <Label>{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nome amigável <contato@seudominio.com.br>"
          disabled={disabled}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Este remetente não segue o formato padrão.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setAvancado(false);
              setNomeExibicao("");
              setCaixa("");
              setDominio(dominiosVerificados[0] ?? "");
              onChange("");
            }}
          >
            Usar os campos guiados
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 grid grid-cols-[1fr_1fr_auto_1.2fr] items-center gap-2">
        <Input
          value={nomeExibicao}
          onChange={(e) => {
            setNomeExibicao(e.target.value);
            emitir({ nomeExibicao: e.target.value });
          }}
          placeholder="Nome (opcional)"
          disabled={disabled}
        />
        <Input
          value={caixa}
          onChange={(e) => {
            const v = e.target.value.trim().toLowerCase();
            setCaixa(v);
            emitir({ caixa: v });
          }}
          placeholder="contato"
          disabled={disabled}
        />
        <span className="text-muted-foreground">@</span>
        <Select
          value={dominio}
          onValueChange={(v) => {
            setDominio(v);
            emitir({ dominio: v });
          }}
          disabled={disabled || dominiosVerificados.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="domínio" />
          </SelectTrigger>
          <SelectContent>
            {dominiosVerificados.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {erroNome ? (
        <p className="mt-1 text-xs text-destructive">{erroNome}</p>
      ) : erroCaixa ? (
        <p className="mt-1 text-xs text-destructive">{erroCaixa}</p>
      ) : caixa && dominio ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Vai chegar como:{" "}
          <span className="font-medium text-foreground">
            {compor({ nomeExibicao, caixa, dominio })}
          </span>
        </p>
      ) : null}
    </div>
  );
}
