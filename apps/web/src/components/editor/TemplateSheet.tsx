"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@usesend/ui/src/sheet";
import { Input } from "@usesend/ui/src/input";
import { Switch } from "@usesend/ui/src/switch";
import { Label } from "@usesend/ui/src/label";
import { FileText, Search } from "lucide-react";

import { api } from "~/trpc/react";

export type TemplateAplicavel = {
  /** JSON do editor, já como objeto. */
  content: Record<string, unknown>;
  /** Só vem quando o lojista marcou "substituir o assunto". */
  subject: string | null;
  nome: string;
};

/**
 * Seletor de templates da jornada de campanha.
 *
 * Nunca abre vazio: além dos templates do time, lista os padrão do sistema
 * ("Templates do Madmail"), que vêm do código. O assunto NUNCA sobrescreve em
 * silêncio — a troca é um checkbox desmarcado, visível antes do clique
 * (decisão do gauntlet: assunto é obrigatório na criação, então sempre há um
 * assunto do lojista em jogo).
 */
export default function TemplateSheet({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  onApply: (t: TemplateAplicavel) => void;
}) {
  const [busca, setBusca] = useState("");
  const [substituirAssunto, setSubstituirAssunto] = useState(false);

  const meusQuery = api.template.getTemplates.useQuery({}, { enabled: open });
  const padraoQuery = api.template.defaultTemplates.useQuery(undefined, {
    enabled: open,
  });

  const meus = useMemo(
    () =>
      (meusQuery.data?.templates ?? []).filter((t) =>
        t.name.toLowerCase().includes(busca.toLowerCase()),
      ),
    [meusQuery.data, busca],
  );

  const padrao = useMemo(
    () =>
      (padraoQuery.data ?? []).filter((t) =>
        t.name.toLowerCase().includes(busca.toLowerCase()),
      ),
    [padraoQuery.data, busca],
  );

  const totalSemFiltro =
    (meusQuery.data?.templates.length ?? 0) + (padraoQuery.data?.length ?? 0);

  function aplicar(t: { name: string; subject: string; content: string | null }) {
    if (!t.content) return;
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(t.content) as Record<string, unknown>;
    } catch {
      return;
    }
    onApply({
      content: json,
      subject: substituirAssunto && t.subject.trim() ? t.subject : null,
      nome: t.name,
    });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Templates</SheetTitle>
          <SheetDescription>
            Escolha um e-mail pronto e troque só os textos e as fotos.
          </SheetDescription>
        </SheetHeader>

        {totalSemFiltro > 6 ? (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar template…"
              className="pl-8"
            />
          </div>
        ) : null}

        <div className="flex-1 space-y-5 overflow-y-auto py-2">
          {meus.length > 0 ? (
            <Grupo titulo="Seus templates">
              {meus.map((t) => (
                <ItemTemplate
                  key={t.id}
                  nome={t.name}
                  assunto={t.subject}
                  onClick={() =>
                    aplicar({
                      name: t.name,
                      subject: t.subject,
                      content: t.content ?? null,
                    })
                  }
                />
              ))}
            </Grupo>
          ) : null}

          {padrao.length > 0 ? (
            <Grupo titulo="Templates do Madmail">
              {meus.length === 0 && !busca ? (
                <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                  Você ainda não criou templates. Estes são os do Madmail — use
                  e edite à vontade.
                </p>
              ) : null}
              {padrao.map((t) => (
                <ItemTemplate
                  key={t.id}
                  nome={t.name}
                  assunto={t.subject}
                  onClick={() => aplicar(t)}
                />
              ))}
            </Grupo>
          ) : null}

          {meus.length === 0 && padrao.length === 0 && busca ? (
            <p className="text-sm text-muted-foreground">
              Nenhum template com esse nome.
            </p>
          ) : null}
        </div>

        <div className="space-y-3 border-t pt-3">
          <div className="flex items-start gap-2">
            <Switch
              id="substituir-assunto"
              checked={substituirAssunto}
              onCheckedChange={setSubstituirAssunto}
            />
            <Label
              htmlFor="substituir-assunto"
              className="text-xs font-normal leading-relaxed text-muted-foreground"
            >
              Substituir o assunto da campanha pelo do template
            </Label>
          </div>
          <Link
            href="/templates"
            className="block text-xs text-muted-foreground underline hover:text-foreground"
          >
            Gerenciar templates →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ItemTemplate({
  nome,
  assunto,
  onClick,
}: {
  nome: string;
  assunto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-foreground/30 hover:bg-accent/50"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {assunto || "Sem assunto"}
        </p>
      </div>
    </button>
  );
}
