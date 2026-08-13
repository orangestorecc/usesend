"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { Switch } from "@usesend/ui/src/switch";
import { Textarea } from "@usesend/ui/src/textarea";
import { Badge } from "@usesend/ui/src/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@usesend/ui/src/tabs";
import { toast } from "@usesend/ui/src/toaster";
import { CheckIcon, CopyIcon, UploadIcon } from "lucide-react";
import { api } from "~/trpc/react";
import { GatewayLogs } from "./gateway-logs";
import { TokenizedCards } from "./tokenized-cards";

type Field = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "file";
  secret?: boolean;
  placeholder?: string;
  help?: string;
  /** Extensões aceitas quando type === "file". */
  accept?: string;
};

const MAX_INSTALLMENTS = 12;

/** Bloco que mostra a URL de webhook a cadastrar no painel do provedor. */
function WebhookUrlBox({ provider }: { provider: "inter" | "rede" }) {
  const { data } = api.paymentGateway.webhookUrls.useQuery();
  const [copied, setCopied] = useState(false);
  const url = data?.[provider] ?? "";

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URL copiada.");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!url) return null;

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs">URL de webhook</Label>
        {data?.protected ? (
          <Badge variant="outline">protegida por token</Badge>
        ) : (
          <Badge variant="destructive">sem token</Badge>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Input readOnly value={url} className="font-mono text-xs" />
        <Button variant="outline" size="icon" onClick={copy}>
          {copied ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <CopyIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Cadastre esta URL no provedor para receber a confirmação automática dos
        pagamentos.
        {!data?.protected
          ? " Defina PAYMENTS_WEBHOOK_TOKEN no ambiente para proteger o endpoint."
          : ""}
      </p>
      {provider === "inter" ? <WebhookInter /> : null}
    </div>
  );
}

/**
 * No Inter o webhook do PIX é cadastrado por API, não pelo painel — e sem esse
 * cadastro o banco simplesmente nunca avisa que a cobrança foi paga. Um
 * pagamento real ficou preso em "pendente" exatamente assim, então o estado
 * fica visível aqui em vez de depender de alguém lembrar.
 */
function WebhookInter() {
  const status = api.paymentGateway.statusWebhookInter.useQuery();
  const utils = api.useUtils();
  const registrar = api.paymentGateway.registrarWebhookInter.useMutation({
    onSuccess: () => {
      toast.success("Webhook cadastrado no Inter.");
      void utils.paymentGateway.statusWebhookInter.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
      {status.isLoading ? (
        <span className="text-xs text-muted-foreground">
          Verificando no Inter…
        </span>
      ) : status.data?.cadastrado ? (
        <>
          <Badge variant="outline">cadastrado no Inter</Badge>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {status.data.webhookUrl}
          </span>
        </>
      ) : (
        <>
          <Badge variant="destructive">não cadastrado</Badge>
          <span className="text-xs text-muted-foreground">
            {status.data?.erro ??
              "Sem isto, o PIX pago não é confirmado sozinho."}
          </span>
        </>
      )}
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        disabled={registrar.isPending}
        onClick={() => registrar.mutate()}
      >
        {registrar.isPending
          ? "Cadastrando…"
          : status.data?.cadastrado
            ? "Recadastrar"
            : "Cadastrar webhook"}
      </Button>
    </div>
  );
}

/** Campo de upload de certificado/chave: lê o arquivo e guarda o conteúdo PEM. */
function FileField({
  field,
  value,
  hasStored,
  onChange,
}: {
  field: Field;
  value: string;
  hasStored: boolean;
  onChange: (content: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    if (!text.includes("-----BEGIN")) {
      toast.error(
        `${file.name} não parece um arquivo PEM válido (esperado "-----BEGIN...").`,
      );
      return;
    }
    onChange(text);
    setFileName(file.name);
    toast.success(`${file.name} carregado.`);
  };

  return (
    <div>
      <Label>{field.label}</Label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={field.accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon className="mr-1.5 h-4 w-4" />
          Escolher arquivo
        </Button>
        <span className="text-xs text-muted-foreground">
          {fileName
            ? `${fileName} (não salvo ainda)`
            : value
              ? "conteúdo carregado (não salvo ainda)"
              : hasStored
                ? "•••• já configurado"
                : "nenhum arquivo"}
        </span>
        <button
          type="button"
          onClick={() => setShowPaste((s) => !s)}
          className="text-xs text-muted-foreground underline"
        >
          {showPaste ? "ocultar" : "ou colar conteúdo"}
        </button>
      </div>
      {showPaste ? (
        <Textarea
          className="mt-2 font-mono text-xs"
          rows={4}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
      {field.help ? (
        <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>
      ) : null}
    </div>
  );
}

/** Editor de parcelas: 1x sempre ativa, demais desligadas por padrão. */
function InstallmentsField({
  value,
  onChange,
  rates,
  onRatesChange,
}: {
  value: string;
  onChange: (v: string) => void;
  rates: string;
  onRatesChange: (v: string) => void;
}) {
  const enabled = new Set(
    (value || "1")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1),
  );
  enabled.add(1);

  const toggle = (n: number) => {
    if (n === 1) return; // 1x não pode ser desligada
    const next = new Set(enabled);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    onChange([...next].sort((a, b) => a - b).join(","));
  };

  return (
    <div>
      <Label>Parcelamento</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        Só as parcelas marcadas aparecem no checkout. Por padrão, apenas 1x fica
        ativa — habilite as demais conscientemente (o repasse e o custo mudam
        por parcela).
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => {
          const on = enabled.has(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              disabled={n === 1}
              className={`h-9 w-12 rounded-md border text-sm transition-colors ${
                on
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:border-foreground/40"
              } ${n === 1 ? "cursor-not-allowed opacity-90" : ""}`}
              title={n === 1 ? "À vista sempre disponível" : undefined}
            >
              {n}x
            </button>
          );
        })}
      </div>

      <JurosPorParcela
        parcelas={[...enabled].sort((a, b) => a - b)}
        value={rates}
        onChange={onRatesChange}
      />
    </div>
  );
}

/** Lê "1:0.99;2:1.99" em um mapa de parcelas para juros ao mês. */
function parseRates(raw: string): Record<number, string> {
  const mapa: Record<number, string> = {};
  for (const par of (raw || "").split(";")) {
    const [n, taxa] = par.split(":");
    if (n && taxa) mapa[Number(n)] = taxa.trim();
  }
  return mapa;
}

/**
 * Juros por parcela, em % ao mês — como o mercado brasileiro expressa. O
 * checkout calcula pela Tabela Price e cobra o total resultante.
 */
function JurosPorParcela({
  parcelas,
  value,
  onChange,
}: {
  parcelas: number[];
  value: string;
  onChange: (v: string) => void;
}) {
  const mapa = parseRates(value);

  const set = (n: number, taxa: string) => {
    const novo = { ...mapa };
    const limpo = taxa.replace(",", ".").trim();
    if (!limpo || Number(limpo) <= 0) delete novo[n];
    else novo[n] = limpo;
    onChange(
      Object.entries(novo)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([k, v]) => `${k}:${v}`)
        .join(";"),
    );
  };

  if (parcelas.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border bg-muted/20 p-3">
      <Label className="text-xs">Juros por parcela (% ao mês)</Label>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Deixe vazio para não cobrar juros. O cálculo usa a Tabela Price, e o
        cliente vê o valor da parcela e o total antes de confirmar.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Em <strong>1x</strong> não há prazo, então o percentual funciona como
        acréscimo sobre o total: 2% em R$ 100,00 cobra R$ 102,00.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {parcelas.map((n) => (
          <div key={n} className="flex items-center gap-1.5">
            <span className="w-7 shrink-0 text-xs text-muted-foreground">
              {n}x
            </span>
            <Input
              className="h-8 text-xs"
              placeholder="0"
              inputMode="decimal"
              defaultValue={mapa[n] ?? ""}
              onBlur={(e) => set(n, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function GatewayCard({
  provider,
  title,
  description,
  tags,
  fields,
  showInstallments,
}: {
  provider: "inter" | "rede";
  title: string;
  description: string;
  tags: string[];
  fields: Field[];
  showInstallments?: boolean;
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
        {fields.map((f) =>
          f.type === "file" ? (
            <FileField
              key={f.key}
              field={f}
              value={values[f.key] ?? ""}
              hasStored={Boolean(has[f.key])}
              onChange={(content) =>
                setValues({ ...values, [f.key]: content })
              }
            />
          ) : (
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
          ),
        )}

        {showInstallments ? (
          <InstallmentsField
            value={values.installments ?? "1"}
            onChange={(v) => setValues({ ...values, installments: v })}
            rates={values.installmentRates ?? ""}
            onRatesChange={(v) =>
              setValues({ ...values, installmentRates: v })
            }
          />
        ) : null}

        <WebhookUrlBox provider={provider} />
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
    <div className="max-w-5xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure os provedores de pagamento da plataforma. As credenciais são
        guardadas criptografadas.
      </p>

      <Tabs defaultValue="inter">
        <TabsList>
          <TabsTrigger value="inter">Banco Inter</TabsTrigger>
          <TabsTrigger value="rede">Rede</TabsTrigger>
          <TabsTrigger value="promo">Cupons</TabsTrigger>
        </TabsList>

        <TabsContent value="inter" className="space-y-6 pt-4">
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
                type: "file",
                accept: ".crt,.pem,.cer",
                placeholder: "-----BEGIN CERTIFICATE-----",
                help: "Arquivo gerado no Internet Banking do Inter (API de Cobrança).",
              },
              {
                key: "privateKey",
                label: "Chave privada (.key)",
                type: "file",
                secret: true,
                accept: ".key,.pem",
                placeholder: "-----BEGIN PRIVATE KEY-----",
                help: "Nunca é exibida depois de salva.",
              },
            ]}
          />
          <GatewayLogs provider="inter" />
        </TabsContent>

        <TabsContent value="rede" className="space-y-6 pt-4">
          <GatewayCard
            provider="rede"
            title="Rede"
            description="Cobranças no cartão de crédito (com tokenização para reuso)."
            tags={["Cartão"]}
            showInstallments
            fields={[
              { key: "pv", label: "PV / Filiação", type: "text" },
              { key: "token", label: "Token", type: "password", secret: true },
            ]}
          />
          <TokenizedCards />
          <GatewayLogs provider="rede" />
        </TabsContent>

        <TabsContent value="promo" className="pt-4">
          <PromoCodesCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
