"use client";

import { Input } from "@usesend/ui/src/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@usesend/ui/src/select";

import {
  formatarTelefone,
  paisPorCodigo,
  PAISES,
  telefoneValido,
} from "~/lib/validadores-br";

/**
 * Telefone com seletor de país.
 *
 * Não uso libphonenumber: são ~150 KB para validar países que este produto
 * não atende. A lista curta em `validadores-br` cobre quem aparece de fato, e
 * a regra brasileira (DDD válido, celular começando com 9) é o que evita erro
 * de digitação na prática.
 */
export default function PhoneInput({
  codigoPais,
  onCodigoPaisChange,
  numero,
  onNumeroChange,
  placeholder,
  disabled,
}: {
  codigoPais: string;
  onCodigoPaisChange: (codigo: string) => void;
  numero: string;
  onNumeroChange: (numero: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const pais = paisPorCodigo(codigoPais);
  const preenchido = numero.trim().length > 0;
  const invalido = preenchido && !telefoneValido(numero, codigoPais);

  return (
    <div>
      <div className="flex gap-2">
        <Select
          value={codigoPais}
          onValueChange={onCodigoPaisChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-[120px] shrink-0">
            <span className="flex items-center gap-1.5">
              <span aria-hidden>{pais.bandeira}</span>
              <span className="text-sm">+{pais.ddi}</span>
            </span>
          </SelectTrigger>
          <SelectContent>
            {PAISES.map((p) => (
              <SelectItem key={p.codigo} value={p.codigo}>
                <span className="flex items-center gap-2">
                  <span aria-hidden>{p.bandeira}</span>
                  <span>{p.nome}</span>
                  <span className="text-muted-foreground">+{p.ddi}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={formatarTelefone(numero, codigoPais)}
          onChange={(e) => onNumeroChange(e.target.value)}
          placeholder={placeholder ?? (pais.codigo === "BR" ? "(81) 99999-8888" : "")}
          disabled={disabled}
          inputMode="tel"
        />
      </div>
      {invalido ? (
        <p className="mt-1 text-xs text-destructive">
          {pais.codigo === "BR"
            ? "Informe DDD e número. Celular tem 11 dígitos e começa com 9 depois do DDD."
            : `Número de ${pais.nome} deve ter ${pais.digitos.join(" ou ")} dígitos.`}
        </p>
      ) : null}
    </div>
  );
}
