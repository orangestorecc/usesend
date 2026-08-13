"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@usesend/ui/src/tabs";
import { toast } from "@usesend/ui/src/toaster";
import { ArrowLeft, CreditCard, QrCode, Barcode, Check, Copy } from "lucide-react";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import BillingContactBlock from "~/components/payments/billing-contact-block";
import {
  TRANSACTIONAL_PLANS,
  MARKETING_PLANS,
  priceLabel,
} from "~/lib/constants/plan-catalog";
import { precoNoPasso } from "@usesend/lib/src/pricing";

type Promo = {
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
};

function applyPromo(priceBRL: number, promo: Promo | null): number {
  if (!promo) return priceBRL;
  let total = priceBRL;
  if (promo.percentOff) total = priceBRL * (1 - promo.percentOff / 100);
  else if (promo.amountOffCents) total = priceBRL - promo.amountOffCents / 100;
  return Math.max(0, Math.round(total * 100) / 100);
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PixState = { copiaECola: string; qrImage: string | null };
type BoletoState = {
  url: string | null;
  linhaDigitavel: string | null;
  codigoBarras: string | null;
};

function CheckoutInner() {
  const sp = useSearchParams();
  const { data: session } = useSession();
  const router = useRouter();
  const product =
    sp.get("product") === "marketing" ? "marketing" : "transactional";
  const plans = product === "marketing" ? MARKETING_PLANS : TRANSACTIONAL_PLANS;
  const passo = Number(sp.get("tier") ?? 0);
  const planoBase = plans.find((p) => p.key === sp.get("plan")) ?? null;

  // O preço do card depende do passo do slider. Sem aplicar isso aqui, o
  // checkout mostraria sempre o valor da faixa inicial.
  const faixa = planoBase ? precoNoPasso(planoBase.key, passo) : null;
  const plan = planoBase
    ? faixa
      ? {
          ...planoBase,
          priceBRL: faixa.precoBRL,
          volume: faixa.volume,
          extra: faixa.extra ?? planoBase.extra,
        }
      : planoBase
    : null;

  const [temResponsavel, setTemResponsavel] = useState(false);
  const [method, setMethod] = useState<"card" | "pix" | "boleto">("card");

  // Cartão
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [saveCard, setSaveCard] = useState(true);
  const [installments, setInstallments] = useState(1);

  // Resultado pendente (PIX / boleto)
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [pix, setPix] = useState<PixState | null>(null);
  const [boleto, setBoleto] = useState<BoletoState | null>(null);

  // Código promocional
  const [showPromo, setShowPromo] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<Promo | null>(null);
  const validatePromo = api.promoCode.validate.useMutation();

  // Parcelas com juros já calculados no servidor. Depende do cupom: o desconto
  // muda a base do cálculo.
  const { data: installmentOptions } = api.payments.installmentPlan.useQuery(
    {
      product,
      planKey: plan?.key ?? "",
      tier: passo,
      promoCode: promo?.code,
    },
    { enabled: Boolean(plan?.key) },
  );
  const opcaoEscolhida = installmentOptions?.find(
    (o) => o.parcelas === installments,
  );

  const checkout = api.payments.checkout.useMutation();

  // Polling do status enquanto PIX/boleto pendente.
  const chargeQuery = api.payments.getCharge.useQuery(
    { chargeId: chargeId ?? "" },
    {
      enabled: !!chargeId && method !== "card",
      refetchInterval: 4000,
    },
  );

  useEffect(() => {
    if (chargeQuery.data?.status === "paid") {
      toast.success("Pagamento confirmado! Plano ativado.");
      router.push("/dashboard");
    }
  }, [chargeQuery.data?.status, router]);

  const applyCode = () => {
    if (!promoInput.trim()) return;
    validatePromo.mutate(
      { code: promoInput },
      {
        onSuccess: (data) => {
          setPromo(data);
          setShowPromo(false);
          toast.success(`Cupom ${data.code} aplicado.`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const basePrice = plan?.priceBRL ?? 0;
  const total = applyPromo(basePrice, promo);

  const submit = () => {
    if (!plan) return;
    if (plan.priceBRL === null) {
      toast.info("Plano personalizado — fale com o time de vendas.");
      return;
    }

    let card:
      | {
          number: string;
          holderName: string;
          expirationMonth: number;
          expirationYear: number;
          securityCode: string;
        }
      | undefined;

    if (method === "card") {
      const m = cardExpiry.match(/^(\d{2})\s*\/\s*(\d{2,4})$/);
      if (!cardNumber || !m || !cardCvc || !cardHolder) {
        toast.error("Preencha os dados do cartão.");
        return;
      }
      const mm = Number(m[1]);
      const yy = m[2]!.length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
      card = {
        number: cardNumber.replace(/\s/g, ""),
        holderName: cardHolder,
        expirationMonth: mm,
        expirationYear: yy,
        securityCode: cardCvc,
      };
    }

    checkout.mutate(
      {
        product,
        planKey: plan.key,
        tier: passo,
        method,
        promoCode: promo?.code,
        saveCard: method === "card" ? saveCard : undefined,
        installments: method === "card" ? installments : undefined,
        card,
      },
      {
        onSuccess: (res) => {
          if (res.status === "paid") {
            toast.success("Pagamento aprovado! Plano ativado.");
            router.push("/dashboard");
            return;
          }
          setChargeId(res.chargeId);
          if (res.method === "pix" && res.pix) setPix(res.pix);
          if (res.method === "boleto" && res.boleto) setBoleto(res.boleto);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Painel esquerdo */}
      <div className="flex justify-center bg-[#05050A] px-8 py-12 text-[#EDEEF0] lg:justify-end lg:pr-16">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/madmail-symbol.png"
              alt="Madmail"
              className="h-8 w-8 rounded-lg"
            />
          </div>

          <div className="mt-10 text-sm opacity-70">
            Assinar {plan?.name ?? "plano"}
          </div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tight">
              {plan ? priceLabel(plan) : "R$ 0"}
            </span>
            {plan?.priceBRL !== null ? (
              <span className="pb-1.5 text-sm leading-tight opacity-60">
                por
                <br />
                mês
              </span>
            ) : null}
          </div>

          <div className="mt-10 space-y-4 text-sm">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="font-medium">{plan?.name}</div>
                <div className="mt-0.5 text-xs opacity-60">
                  Cobrado mensalmente
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono">
                  {plan ? priceLabel(plan) : "R$ 0"}
                </div>
                <div className="mt-0.5 text-xs opacity-60">{plan?.volume}</div>
              </div>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-4">
              <span className="opacity-70">Subtotal</span>
              <span className="font-mono">
                {plan ? priceLabel(plan) : "R$ 0"}
              </span>
            </div>

            {promo ? (
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="flex items-center gap-2">
                  <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">
                    {promo.code}
                  </span>
                  <button
                    onClick={() => setPromo(null)}
                    className="text-xs opacity-60 underline hover:opacity-100"
                  >
                    remover
                  </button>
                </span>
                <span className="font-mono text-emerald-400">
                  −{" "}
                  {promo.percentOff
                    ? `${promo.percentOff}%`
                    : brl((promo.amountOffCents ?? 0) / 100)}
                </span>
              </div>
            ) : showPromo ? (
              <div className="flex gap-2 border-b border-white/10 pb-4">
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && applyCode()}
                  placeholder="CÓDIGO"
                  className="w-full rounded-md border border-white/20 bg-transparent px-3 py-1.5 font-mono text-sm outline-none placeholder:opacity-40"
                  autoFocus
                />
                <button
                  onClick={applyCode}
                  disabled={validatePromo.isPending}
                  className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-50"
                >
                  {validatePromo.isPending ? "..." : "Aplicar"}
                </button>
              </div>
            ) : (
              <div className="border-b border-white/10 pb-4">
                <button
                  onClick={() => setShowPromo(true)}
                  className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
                >
                  Adicionar código promocional
                </button>
              </div>
            )}

            <div className="flex justify-between font-semibold">
              <span>Total devido hoje</span>
              <span className="font-mono">
                {plan?.priceBRL === null ? "—" : brl(total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Painel direito */}
      <div className="flex justify-center bg-background px-8 py-12 lg:justify-start lg:pl-16">
        <div className="w-full max-w-md">
          {/* Estado pendente: PIX */}
          {pix ? (
            <div className="space-y-4">
              <div className="text-sm font-medium">Pague com PIX</div>
              {pix.qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pix.qrImage}
                  alt="QR Code PIX"
                  className="mx-auto h-56 w-56 rounded-lg border"
                />
              ) : null}
              <div>
                <Label className="text-xs text-muted-foreground">
                  PIX copia e cola
                </Label>
                <div className="mt-1 flex gap-2">
                  <Input readOnly value={pix.copiaECola} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(pix.copiaECola)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Aguardando pagamento… a página confirma automaticamente.
              </p>
            </div>
          ) : boleto ? (
            <div className="space-y-4">
              <div className="text-sm font-medium">Boleto gerado</div>
              {boleto.linhaDigitavel ? (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Linha digitável
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      readOnly
                      value={boleto.linhaDigitavel}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copy(boleto.linhaDigitavel!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cole no app do banco para pagar sem ler o código.
                  </p>
                </div>
              ) : null}
              {boleto.codigoBarras ? (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Código de barras
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      readOnly
                      value={boleto.codigoBarras}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copy(boleto.codigoBarras!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
              {boleto.url ? (
                <a href={boleto.url} target="_blank" rel="noreferrer">
                  <Button className="w-full" variant="outline">
                    <Barcode className="mr-2 h-4 w-4" /> Baixar boleto (PDF)
                  </Button>
                </a>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Após o pagamento, o plano é ativado automaticamente.
              </p>
            </div>
          ) : (
            <>
              <div className="text-sm font-medium">Dados de faturamento</div>
              <div className="mt-2">
                <BillingContactBlock
                  emailDoMembro={session?.user?.email}
                  onPreenchidoChange={setTemResponsavel}
                />
              </div>

              <div className="mt-8">
                <div className="mb-2 text-sm font-medium">Forma de pagamento</div>
                <Tabs
                  value={method}
                  onValueChange={(v) => setMethod(v as typeof method)}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="card">
                      <CreditCard className="mr-1.5 h-4 w-4" /> Cartão
                    </TabsTrigger>
                    <TabsTrigger value="pix">
                      <QrCode className="mr-1.5 h-4 w-4" /> PIX
                    </TabsTrigger>
                    <TabsTrigger value="boleto">
                      <Barcode className="mr-1.5 h-4 w-4" /> Boleto
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="card" className="space-y-3 pt-4">
                    <div>
                      <Label>Dados do cartão</Label>
                      <Input
                        className="mt-1"
                        placeholder="1234 1234 1234 1234"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="MM / AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                      />
                      <Input
                        placeholder="CVC"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <Label>Nome do titular</Label>
                      <Input
                        className="mt-1"
                        placeholder="Nome completo"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                      />
                    </div>
                    {installmentOptions && installmentOptions.length > 1 ? (
                      <div>
                        <Label>Parcelamento</Label>
                        <select
                          className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
                          value={installments}
                          onChange={(e) =>
                            setInstallments(Number(e.target.value))
                          }
                        >
                          {installmentOptions.map((o) => (
                            <option key={o.parcelas} value={o.parcelas}>
                              {o.parcelas}x de {brl(o.valorParcelaCents / 100)}
                              {o.parcelas === 1
                                ? " à vista"
                                : o.semJuros
                                  ? " sem juros"
                                  : ` com juros — total ${brl(o.totalCents / 100)}`}
                            </option>
                          ))}
                        </select>
                        {opcaoEscolhida && !opcaoEscolhida.semJuros ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Juros de {opcaoEscolhida.jurosAoMes}% ao mês. Você
                            paga {brl(opcaoEscolhida.totalCents / 100)} no total.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="rounded border"
                        checked={saveCard}
                        onChange={(e) => setSaveCard(e.target.checked)}
                      />
                      Salvar cartão para cobranças futuras (recorrência)
                    </label>
                  </TabsContent>

                  <TabsContent value="pix" className="pt-4">
                    <div className="flex flex-col items-center rounded-lg border border-dashed p-8 text-center">
                      <QrCode className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm">
                        Um QR Code PIX será gerado via Banco Inter.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pagamento confirmado automaticamente (webhook).
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="boleto" className="pt-4">
                    <div className="flex flex-col items-center rounded-lg border border-dashed p-8 text-center">
                      <Barcode className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm">
                        Um boleto será emitido via Banco Inter.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Compensação em até 2 dias úteis.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <Button
                className="mt-8 w-full"
                size="lg"
                onClick={submit}
                disabled={checkout.isPending || !temResponsavel}
                title={
                  !temResponsavel
                    ? "Cadastre o responsável financeiro antes de pagar"
                    : undefined
                }
              >
                {checkout.isPending ? (
                  "Processando…"
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Assinar
                  </>
                )}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Ao assinar, você autoriza o Madmail a cobrar em BRL de forma
                recorrente mensal, conforme os termos.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}
