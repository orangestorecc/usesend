"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { Switch } from "@usesend/ui/src/switch";
import { Textarea } from "@usesend/ui/src/textarea";
import { Badge } from "@usesend/ui/src/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { toast } from "@usesend/ui/src/toaster";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";

type Product = "transactional" | "marketing";

type Entry = {
  id?: string;
  product: Product;
  key: string;
  name: string;
  priceBRL: number | null;
  volume: string;
  extra: string | null;
  features: { label: string; ok: boolean }[];
  highlight: boolean;
  sortOrder: number;
  active: boolean;
};

// Features no textarea: uma por linha; prefixo "x " marca como não incluída.
function featuresToText(features: { label: string; ok: boolean }[]): string {
  return features.map((f) => (f.ok ? f.label : `x ${f.label}`)).join("\n");
}
function textToFeatures(text: string): { label: string; ok: boolean }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      l.toLowerCase().startsWith("x ")
        ? { label: l.slice(2).trim(), ok: false }
        : { label: l, ok: true },
    );
}

function EditDialog({
  entry,
  onClose,
}: {
  entry: Entry;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const upsert = api.planCatalog.upsert.useMutation();
  const [e, setE] = useState<Entry>(entry);
  const [featuresText, setFeaturesText] = useState(
    featuresToText(entry.features),
  );
  const [custom, setCustom] = useState(entry.priceBRL === null);

  const save = () => {
    upsert.mutate(
      {
        id: e.id,
        product: e.product,
        key: e.key,
        name: e.name,
        priceBRL: custom ? null : (e.priceBRL ?? 0),
        volume: e.volume,
        extra: e.extra || null,
        features: textToFeatures(featuresText),
        highlight: e.highlight,
        sortOrder: e.sortOrder,
        active: e.active,
      },
      {
        onSuccess: () => {
          utils.planCatalog.invalidate();
          toast.success("Plano salvo.");
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{e.id ? "Editar plano" : "Novo plano"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input
                className="mt-1"
                value={e.name}
                onChange={(ev) => setE({ ...e, name: ev.target.value })}
              />
            </div>
            <div>
              <Label>Chave (identificador)</Label>
              <Input
                className="mt-1 font-mono text-xs"
                value={e.key}
                disabled={Boolean(e.id)}
                onChange={(ev) => setE({ ...e, key: ev.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <Label>Preço (R$/mês)</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                disabled={custom}
                value={custom ? "" : (e.priceBRL ?? 0)}
                onChange={(ev) =>
                  setE({ ...e, priceBRL: Number(ev.target.value) })
                }
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Switch checked={custom} onCheckedChange={setCustom} />
              Personalizado (Enterprise)
            </label>
          </div>

          <div>
            <Label>Volume (linha principal)</Label>
            <Input
              className="mt-1"
              value={e.volume}
              placeholder="50.000 e-mails / mês"
              onChange={(ev) => setE({ ...e, volume: ev.target.value })}
            />
          </div>
          <div>
            <Label>Linha extra (opcional)</Label>
            <Input
              className="mt-1"
              value={e.extra ?? ""}
              placeholder="E-mails extras: R$ 0,90 / 1.000"
              onChange={(ev) => setE({ ...e, extra: ev.target.value })}
            />
          </div>

          <div>
            <Label>Features (uma por linha)</Label>
            <Textarea
              className="mt-1 text-sm"
              rows={8}
              value={featuresText}
              onChange={(ev) => setFeaturesText(ev.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Prefixe com <code>x </code> para marcar como não incluída (✗).
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={e.highlight}
                onCheckedChange={(v) => setE({ ...e, highlight: v })}
              />
              Destaque
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={e.active}
                onCheckedChange={(v) => setE({ ...e, active: v })}
              />
              Ativo
            </label>
            <div>
              <Label className="text-xs">Ordem</Label>
              <Input
                type="number"
                className="mt-1"
                value={e.sortOrder}
                onChange={(ev) =>
                  setE({ ...e, sortOrder: Number(ev.target.value) })
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={upsert.isPending}>
            {upsert.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlanosAdminPage() {
  const utils = api.useUtils();
  const listQuery = api.planCatalog.adminList.useQuery();
  const del = api.planCatalog.delete.useMutation({
    onSuccess: () => {
      utils.planCatalog.invalidate();
      toast.success("Plano removido.");
    },
    onError: (e) => toast.error(e.message),
  });
  const [editing, setEditing] = useState<Entry | null>(null);
  const [product, setProduct] = useState<Product>("transactional");

  const rows = (listQuery.data ?? []).filter((r) => r.product === product);

  const newEntry = (): Entry => ({
    product,
    key: "",
    name: "",
    priceBRL: 0,
    volume: "",
    extra: null,
    features: [],
    highlight: false,
    sortOrder: rows.length,
    active: true,
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-1">
          {(
            [
              ["transactional", "E-mails transacionais"],
              ["marketing", "E-mails de marketing"],
            ] as const
          ).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setProduct(p)}
              className={`rounded-full px-4 py-1.5 text-sm transition-all ${
                product === p
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setEditing(newEntry())}>
          <Plus className="mr-1 h-4 w-4" />
          Novo plano
        </Button>
      </div>

      <div className="mt-4 rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">
                  {r.sortOrder}
                </TableCell>
                <TableCell className="font-medium">
                  {r.name}
                  {r.highlight ? (
                    <Badge variant="outline" className="ml-2">
                      Destaque
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {r.priceBRL === null ? "Personalizado" : `R$ ${r.priceBRL}/mês`}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.volume}
                </TableCell>
                <TableCell>
                  <Badge variant={r.active ? "outline" : "secondary"}>
                    {r.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          id: r.id,
                          product: r.product as Product,
                          key: r.key,
                          name: r.name,
                          priceBRL: r.priceBRL,
                          volume: r.volume,
                          extra: r.extra,
                          features:
                            (r.features as { label: string; ok: boolean }[]) ??
                            [],
                          highlight: r.highlight,
                          sortOrder: r.sortOrder,
                          active: r.active,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Remover o plano "${r.name}"?`)) {
                          del.mutate({ id: r.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        As alterações refletem na modal de upgrade e na jornada de assinatura.
      </p>

      {editing ? (
        <EditDialog entry={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
