"use client";

import { useEffect, useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { Switch } from "@usesend/ui/src/switch";
import { Textarea } from "@usesend/ui/src/textarea";
import { Badge } from "@usesend/ui/src/badge";
import { toast } from "@usesend/ui/src/toaster";
import { api } from "~/trpc/react";

type Field = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  secret?: boolean;
  placeholder?: string;
  help?: string;
};

function GatewayCard({
  provider,
  title,
  description,
  tags,
  fields,
}: {
  provider: "inter" | "rede";
  title: string;
  description: string;
  tags: string[];
  fields: Field[];
}) {
  const utils = api.useUtils();
  const query = api.paymentGateway.get.useQuery({ provider });
  const update = api.paymentGateway.update.useMutation();
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [has, setHas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const d = query.data;
    if (!d) return;
    setEnabled(d.enabled);
    setValues(d.config);
    setHas(d.has);
  }, [query.data]);

  const save = () => {
    update.mutate(
      { provider, enabled, config: values },
      {
        onSuccess: () => {
          utils.paymentGateway.get.invalidate({ provider });
          toast.success("Credenciais salvas.");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="rounded-xl border shadow-sm">
      <div className="flex items-start justify-between border-b p-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">{title}</h2>
            {tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {enabled ? "Ativo" : "Inativo"}
          </span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className="space-y-4 p-6">
        {fields.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea
                className="mt-1 font-mono text-xs"
                rows={4}
                placeholder={
                  f.secret && has[f.key]
                    ? "•••• já configurado (deixe em branco para manter)"
                    : f.placeholder
                }
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              />
            ) : (
              <Input
                className="mt-1"
                type={f.type}
                placeholder={
                  f.secret && has[f.key]
                    ? "•••• já configurado (deixe em branco para manter)"
                    : f.placeholder
                }
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              />
            )}
            {f.help ? (
              <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="border-t bg-muted/20 px-6 py-3">
        <Button size="sm" onClick={save} disabled={update.isPending}>
          {update.isPending ? "Salvando..." : "Salvar credenciais"}
        </Button>
      </div>
    </div>
  );
}

function PromoCodesCard() {
  const utils = api.useUtils();
  const listQuery = api.promoCode.list.useQuery();
  const create = api.promoCode.create.useMutation();
  const toggle = api.promoCode.toggle.useMutation({
    onSuccess: () => utils.promoCode.list.invalidate(),
  });
  const del = api.promoCode.delete.useMutation({
    onSuccess: () => utils.promoCode.list.invalidate(),
  });

  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const add = () => {
    const num = Number(value);
    if (!code.trim() || !num) {
      toast.error("Informe o código e o valor do desconto.");
      return;
    }
    create.mutate(
      {
        code,
        percentOff: type === "percent" ? num : undefined,
        amountOffCents: type === "fixed" ? Math.round(num * 100) : undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        expiresAt: expiresAt
          ? new Date(`${expiresAt}T23:59:59`).toISOString()
          : undefined,
      },
      {
        onSuccess: () => {
          utils.promoCode.list.invalidate();
          toast.success("Cupom criado.");
          setCode("");
          setValue("");
          setMaxRedemptions("");
          setExpiresAt("");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="rounded-xl border shadow-sm">
      <div className="border-b p-6">
        <h2 className="text-base font-semibold">Códigos promocionais</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cupons de desconto aplicáveis no checkout.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-5">
        <div>
          <Label className="text-xs">Código</Label>
          <Input
            className="mt-1 font-mono uppercase"
            value={code}
            placeholder="BEMVINDO10"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as "percent" | "fixed")}
          >
            <option value="percent">% de desconto</option>
            <option value="fixed">R$ fixo</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">
            {type === "percent" ? "Percentual (%)" : "Valor (R$)"}
          </Label>
          <Input
            className="mt-1"
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Limite de usos</Label>
          <Input
            className="mt-1"
            type="number"
            min={1}
            placeholder="∞"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Expira em</Label>
          <Input
            className="mt-1"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>
      <div className="px-6 pb-4">
        <Button size="sm" onClick={add} disabled={create.isPending}>
          {create.isPending ? "Criando..." : "Criar cupom"}
        </Button>
      </div>

      {listQuery.data?.length ? (
        <div className="divide-y border-t">
          {listQuery.data.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-6 py-3 text-sm"
            >
              <span className="font-mono font-medium">{p.code}</span>
              <span className="text-muted-foreground">
                {p.percentOff
                  ? `${p.percentOff}% off`
                  : `R$ ${((p.amountOffCents ?? 0) / 100).toFixed(2)} off`}
              </span>
              <span className="text-xs text-muted-foreground">
                {p.redemptions}
                {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""} usos
                {p.expiresAt
                  ? ` · expira ${new Date(p.expiresAt).toLocaleDateString("pt-BR")}`
                  : ""}
              </span>
              <div className="flex items-center gap-3">
                <Switch
                  checked={p.active}
                  onCheckedChange={(v) => toggle.mutate({ id: p.id, active: v })}
                />
                <button
                  onClick={() => {
                    if (confirm(`Remover o cupom ${p.code}?`)) {
                      del.mutate({ id: p.id });
                    }
                  }}
                  className="text-xs text-destructive underline"
                >
                  remover
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="border-t px-6 py-4 text-sm text-muted-foreground">
          Nenhum cupom criado ainda.
        </p>
      )}
    </div>
  );
}

export default function AdminPaymentsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure os provedores de pagamento da plataforma. As credenciais são
        guardadas criptografadas.
      </p>

      <PromoCodesCard />

      <GatewayCard
        provider="inter"
        title="Banco Inter"
        description="Cobranças via PIX e boleto bancário."
        tags={["PIX", "Boleto"]}
        fields={[
          { key: "clientId", label: "Client ID", type: "text" },
          {
            key: "clientSecret",
            label: "Client Secret",
            type: "password",
            secret: true,
          },
          {
            key: "pixKey",
            label: "Chave PIX (cadastrada no Inter)",
            type: "text",
            help: "Use a mesma chave PIX vinculada à conta Inter. Sem ela, apenas boletos serão emitidos.",
          },
          {
            key: "certificate",
            label: "Certificado (.crt)",
            type: "textarea",
            placeholder: "-----BEGIN CERTIFICATE-----",
          },
          {
            key: "privateKey",
            label: "Chave privada (.key)",
            type: "textarea",
            secret: true,
            placeholder: "-----BEGIN PRIVATE KEY-----",
          },
        ]}
      />

      <GatewayCard
        provider="rede"
        title="Rede"
        description="Cobranças no cartão de crédito (com tokenização para reuso)."
        tags={["Cartão"]}
        fields={[
          { key: "pv", label: "PV / Filiação", type: "text" },
          { key: "token", label: "Token", type: "password", secret: true },
        ]}
      />
    </div>
  );
}
