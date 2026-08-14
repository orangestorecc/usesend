"use client";

import { useEffect, useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Card } from "@usesend/ui/src/card";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { Spinner } from "@usesend/ui/src/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { toast } from "@usesend/ui/src/toaster";
import { Plus, X, Download, CreditCard, QrCode, Banknote } from "lucide-react";
import { format } from "date-fns";
import { useTeam } from "~/providers/team-context";
import { api } from "~/trpc/react";
import { InvoiceDetailsDialog } from "./invoice-details-dialog";
import { DowngradeCard } from "./downgrade-card";
import PhoneInput from "~/components/phone-input";
import {
  emailValido,
  separarTelefone,
  telefoneParaArmazenar,
  telefoneValido,
} from "~/lib/validadores-br";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const FORMA_LABEL: Record<string, string> = {
  card: "Cartão de crédito",
  pix: "PIX",
  boleto: "Boleto bancário",
};

const ICONE_FORMA: Record<string, typeof CreditCard> = {
  card: CreditCard,
  pix: QrCode,
  boleto: Banknote,
};

function SectionCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
      {footer ? <div className="border-t bg-muted/20 px-6 py-3">{footer}</div> : null}
    </Card>
  );
}

export default function BillingPage() {
  const { currentTeam, currentIsAdmin } = useTeam();
  const utils = api.useUtils();

  const profileQuery = api.billingProfile.get.useQuery();
  const invoicesQuery = api.billingProfile.invoices.useQuery();
  const billingState = api.payments.billingState.useQuery();
  const formasQuery = api.payments.paymentMethods.useQuery();
  const definirPadrao = api.payments.definirFormaPadrao.useMutation();
  const updateContact = api.billingProfile.updateContact.useMutation();
  const updateFiscal = api.billingProfile.updateFiscal.useMutation();

  // Contato de faturamento
  const [faturaAberta, setFaturaAberta] = useState<string | null>(null);
  const [emails, setEmails] = useState<string[]>([""]);
  const [paisWhatsapp, setPaisWhatsapp] = useState("BR");
  const [whatsapp, setWhatsapp] = useState("");
  // Só mostra os erros depois da primeira tentativa de salvar: apontar erro em
  // campo que a pessoa ainda está digitando é ruído.
  const [mostrarErros, setMostrarErros] = useState(false);
  // Fiscal
  const [personType, setPersonType] = useState("PJ");
  const [document, setDocument] = useState("");
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    setEmails(p.billingEmails.length ? p.billingEmails : [""]);
    const tel = separarTelefone(p.whatsapp ?? "");
    setPaisWhatsapp(tel.codigoPais);
    setWhatsapp(tel.numero);
    setPersonType(p.personType);
    setDocument(p.document ?? "");
    setName(p.name ?? "");
    setTradeName(p.tradeName ?? "");
    setPostalCode(p.postalCode ?? "");
    setAddressLine1(p.addressLine1 ?? "");
    setDistrict(p.district ?? "");
    setCity(p.city ?? "");
    setUf(p.state ?? "");
  }, [profileQuery.data]);

  if (!currentIsAdmin) return null;
  if (!currentTeam?.plan || profileQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <Spinner className="h-4 w-4" />
      </div>
    );
  }

  const emailsInvalidos = emails.map((e) => {
    const v = e.trim();
    return v.length > 0 && !emailValido(v);
  });
  const whatsappPreenchido = whatsapp.trim().length > 0;
  const whatsappInvalido =
    whatsappPreenchido && !telefoneValido(whatsapp, paisWhatsapp);

  const saveContact = () => {
    const clean = emails.map((e) => e.trim()).filter(Boolean);
    setMostrarErros(true);
    if (emailsInvalidos.some(Boolean) || whatsappInvalido) {
      toast.error("Confira os campos destacados antes de salvar.");
      return;
    }
    if (!clean.length) {
      toast.error("Informe ao menos um e-mail de faturamento.");
      return;
    }
    updateContact.mutate(
      {
        billingEmails: clean,
        whatsapp: whatsappPreenchido
          ? telefoneParaArmazenar(whatsapp, paisWhatsapp)
          : null,
      },
      {
        onSuccess: () => {
          utils.billingProfile.get.invalidate();
          setMostrarErros(false);
          toast.success("Contato de faturamento salvo.");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const saveFiscal = () => {
    updateFiscal.mutate(
      {
        personType: personType as "PF" | "PJ",
        document: document || null,
        name: name || null,
        tradeName: personType === "PJ" ? tradeName || null : null,
        postalCode: postalCode || null,
        addressLine1: addressLine1 || null,
        district: district || null,
        city: city || null,
        state: uf || null,
      },
      {
        onSuccess: () => {
          utils.billingProfile.get.invalidate();
          toast.success("Dados fiscais salvos.");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* E-mail de faturamento + WhatsApp */}
      <SectionCard
        title="Contato de faturamento"
        description="As faturas e avisos de cobrança serão enviados para estes contatos."
        footer={
          <Button size="sm" onClick={saveContact} disabled={updateContact.isPending}>
            {updateContact.isPending ? "Salvando..." : "Salvar"}
          </Button>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>E-mails de faturamento</Label>
            <div className="mt-1 space-y-2">
              {emails.map((email, i) => {
                const invalido = mostrarErros && emailsInvalidos[i];
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2">
                      <Input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        placeholder="financeiro@empresa.com"
                        aria-invalid={invalido || undefined}
                        className={invalido ? "border-destructive" : undefined}
                        onChange={(e) => {
                          const next = [...emails];
                          next[i] = e.target.value;
                          setEmails(next);
                        }}
                      />
                      {emails.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEmails(emails.filter((_, idx) => idx !== i))
                          }
                          className="rounded p-2 text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    {invalido ? (
                      <p className="mt-1 text-xs text-destructive">
                        E-mail inválido. Use o formato nome@empresa.com.
                      </p>
                    ) : null}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEmails([...emails, ""])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Adicionar e-mail
              </Button>
            </div>
          </div>
          <div>
            <Label>WhatsApp</Label>
            <div className="mt-1">
              <PhoneInput
                codigoPais={paisWhatsapp}
                onCodigoPaisChange={setPaisWhatsapp}
                numero={whatsapp}
                onNumeroChange={setWhatsapp}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Formas de pagamento */}
      <SectionCard
        title="Formas de pagamento"
        description="Cartão de crédito, PIX ou boleto. Uma delas será a padrão ao assinar um plano pago."
      >
        {formasQuery.data?.length ? (
          <div className="divide-y rounded-lg border">
            {formasQuery.data.map((forma) => {
              const Icone = ICONE_FORMA[forma.type] ?? CreditCard;
              return (
                <div key={forma.id} className="flex items-center gap-3 p-3">
                  <Icone className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {FORMA_LABEL[forma.type] ?? forma.type}
                      {forma.last4 ? (
                        <span className="ml-2 font-normal text-muted-foreground">
                          {forma.brand ? `${forma.brand} ` : ""}•••• {forma.last4}
                        </span>
                      ) : null}
                    </p>
                    {forma.type === "card" && forma.expMonth && forma.expYear ? (
                      <p className="text-xs text-muted-foreground">
                        Validade{" "}
                        {String(forma.expMonth).padStart(2, "0")}/{forma.expYear}
                      </p>
                    ) : null}
                  </div>
                  {forma.isDefault ? (
                    <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Padrão
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      disabled={definirPadrao.isPending}
                      onClick={() =>
                        definirPadrao.mutate(
                          { id: forma.id },
                          {
                            onSuccess: () => {
                              utils.payments.paymentMethods.invalidate();
                              toast.success("Forma padrão atualizada.");
                            },
                            onError: (e) => toast.error(e.message),
                          },
                        )
                      }
                    >
                      Tornar padrão
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhuma forma de pagamento usada ainda.
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              No plano grátis não há forma padrão. Ao assinar um plano pago, a
              forma escolhida no checkout vira a padrão e aparece aqui.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Responsável financeiro / dados fiscais */}
      <SectionCard
        title="Responsável financeiro"
        description="Estes dados são usados para a emissão da nota fiscal (NF-e)."
        footer={
          <Button size="sm" onClick={saveFiscal} disabled={updateFiscal.isPending}>
            {updateFiscal.isPending ? "Salvando..." : "Salvar"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Tipo</Label>
            <Select value={personType} onValueChange={setPersonType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PF">Pessoa física</SelectItem>
                <SelectItem value="PJ">Pessoa jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{personType === "PF" ? "CPF" : "CNPJ"}</Label>
            <Input
              className="mt-1"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder={personType === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
            />
          </div>
          <div className={personType === "PJ" ? "" : "sm:col-span-2"}>
            <Label>{personType === "PF" ? "Nome completo" : "Razão social"}</Label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {personType === "PJ" ? (
            <div>
              <Label>Nome fantasia</Label>
              <Input
                className="mt-1"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <Label>País</Label>
            <Input className="mt-1" value="Brasil" disabled />
          </div>
          <div>
            <Label>CEP</Label>
            <Input
              className="mt-1"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="00000-000"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço</Label>
            <Input
              className="mt-1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Rua, número, complemento"
            />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input
              className="mt-1"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Cidade</Label>
              <Input
                className="mt-1"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <Label>UF</Label>
              <Input
                className="mt-1"
                value={uf}
                maxLength={2}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Faturas */}
      <SectionCard
        title="Faturas"
        description="Histórico de cobranças, com o plano e o desconto de cada uma."
      >
        {invoicesQuery.data?.length ? (
          <div className="divide-y">
            {invoicesQuery.data.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 py-3 text-sm"
              >
                {/* Plano e data mandam na leitura; o número da fatura é
                    referência de suporte, então fica secundário. */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {inv.planName ?? inv.description ?? "Assinatura"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {format(new Date(inv.issuedAt), "dd MMM yyyy")}
                    <span className="mx-1.5">·</span>
                    <span className="font-mono">{inv.number}</span>
                    {inv.discountCents > 0 ? (
                      <>
                        <span className="mx-1.5">·</span>
                        <span className="text-emerald-600">
                          cupom {inv.promoCode ?? "aplicado"}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>

                <span className="font-mono">{brl(inv.amountCents)}</span>

                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                    inv.status === "paid"
                      ? "bg-emerald-100 text-emerald-700"
                      : inv.status === "open"
                        ? "bg-red-100 text-red-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {inv.status === "paid"
                    ? "Paga"
                    : inv.status === "open"
                      ? "Aberta"
                      : "Cancelada"}
                </span>

                {/* Botão explícito: a linha inteira ser clicável não se anuncia
                    sozinha, e quem não descobre nunca vê o detalhe da conta. */}
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setFaturaAberta(inv.id)}
                >
                  Ver detalhes
                </Button>

                {inv.pdfUrl ? (
                  <a
                    href={inv.pdfUrl}
                    title="Baixar fatura"
                    className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="w-7 shrink-0" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma fatura ainda.
          </p>
        )}
      </SectionCard>

      {/* Só aparece para quem tem o que rebaixar, e só para o admin do time. */}
      {billingState.data?.isPaid && currentIsAdmin ? (
        <DowngradeCard planName={billingState.data.planName} />
      ) : null}

      <InvoiceDetailsDialog
        invoiceId={faturaAberta}
        onOpenChange={(open) => {
          if (!open) setFaturaAberta(null);
        }}
      />
    </div>
  );
}
