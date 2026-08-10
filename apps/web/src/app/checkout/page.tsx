"use client";

import { Suspense, useState } from "react";
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
import { ArrowLeft, CreditCard, QrCode, Barcode } from "lucide-react";
import { api } from "~/trpc/react";
import {
  TRANSACTIONAL_PLANS,
  MARKETING_PLANS,
  priceLabel,
} from "~/lib/constants/plan-catalog";

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

function CheckoutInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const product = sp.get("product") === "marketing" ? "marketing" : "transactional";
  const plans = product === "marketing" ? MARKETING_PLANS : TRANSACTIONAL_PLANS;
  const plan = plans.find((p) => p.key === sp.get("plan")) ?? null;

  const [email, setEmail] = useState("");
  void email;

  // Código promocional
  const [showPromo, setShowPromo] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<Promo | null>(null);
  const validatePromo = api.promoCode.validate.useMutation();

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

  const notReady = () =>
    toast.info("Integração de pagamento em breve — este é o front do checkout.");

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Painel esquerdo — escuro, conteúdo alinhado ao centro da tela */}
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

            {/* Código promocional */}
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

      {/* Painel direito — claro, conteúdo alinhado ao centro da tela */}
      <div className="flex justify-center bg-background px-8 py-12 lg:justify-start lg:pl-16">
        <div className="w-full max-w-md">
          <div className="text-sm font-medium">Dados para contato</div>
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">E-mail</Label>
            <Input
              className="mt-1"
              type="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="mt-8">
            <div className="mb-2 text-sm font-medium">Forma de pagamento</div>
            <Tabs defaultValue="card">
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
                  <Input className="mt-1" placeholder="1234 1234 1234 1234" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="MM / AA" />
                  <Input placeholder="CVC" />
                </div>
                <div>
                  <Label>Nome do titular</Label>
                  <Input className="mt-1" placeholder="Nome completo" />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" className="rounded border" />
                  Salvar cartão para cobranças futuras
                </label>
                <p className="text-xs text-muted-foreground">
                  O cartão será tokenizado pela Rede — os dados não passam pelo
                  nosso servidor.
                </p>
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

          <Button className="mt-8 w-full" size="lg" onClick={notReady}>
            Assinar
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Ao assinar, você autoriza o Madmail a cobrar em BRL de forma
            recorrente mensal, conforme os termos.
          </p>
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
