"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { Button } from "@usesend/ui/src/button";
import { Check, X } from "lucide-react";
import { api } from "~/trpc/react";
import { estadoDoCard, passoDoPlano } from "@usesend/lib/src/pricing";
import {
  TRANSACTIONAL_PLANS,
  MARKETING_PLANS,
  TRANSACTIONAL_TIERS,
  MARKETING_TIERS,
  priceLabel,
  type CatalogPlan,
} from "~/lib/constants/plan-catalog";

type Product = "transactional" | "marketing";

export function PlansModal({
  open,
  onOpenChange,
  defaultProduct = "transactional",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProduct?: Product;
}) {
  const [product, setProduct] = useState<Product>(defaultProduct);
  const [tier, setTier] = useState(0);
  const [confirming, setConfirming] = useState<CatalogPlan | null>(null);

  // Catálogo gerenciável (admin) com fallback pros defaults do código.
  const catalogQuery = api.planCatalog.list.useQuery(undefined, {
    enabled: open,
  });
  // Plano vigente de verdade: sem isso a modal chamava de "atual" o card mais
  // barato, e quem já era Pro via "Plano atual" no Free.
  const billingState = api.payments.billingState.useQuery(undefined, {
    enabled: open,
  });

  const plans: CatalogPlan[] =
    (product === "transactional"
      ? catalogQuery.data?.transactional
      : catalogQuery.data?.marketing) ??
    (product === "transactional" ? TRANSACTIONAL_PLANS : MARKETING_PLANS);

  const tiers =
    product === "transactional" ? TRANSACTIONAL_TIERS : MARKETING_TIERS;

  const planKeyAtual = billingState.data?.planKey ?? "free";
  const produtoAtual = billingState.data?.planProduct ?? "transactional";
  const currentPlan =
    plans.find((p) => p.key === planKeyAtual) ??
    plans.find((p) => p.priceBRL === 0) ??
    plans[0]!;

  // Ao abrir na aba do produto que a pessoa já assina, o slider começa onde o
  // plano dela está — não no degrau zero, que não é onde ela vive.
  useEffect(() => {
    if (!open) return;
    setProduct(defaultProduct);
    setConfirming(null);
    setTier(
      defaultProduct === produtoAtual && planKeyAtual !== "free"
        ? passoDoPlano(defaultProduct, planKeyAtual, 0)
        : 0,
    );
  }, [open, defaultProduct, produtoAtual, planKeyAtual]);

  const switchProduct = (p: Product) => {
    setProduct(p);
    setTier(0);
    setConfirming(null);
  };

  /**
   * Encosta o slider no volume que o plano escolhido entrega.
   *
   * O card do Pro marketing já mostra "5.000 contatos / R$ 200" com o slider
   * em 1.000: o plano não vende 1.000, vende 5.000. Antes, quem clicava
   * fechava a compra de 5.000 olhando 1.000 na tela.
   */
  const escolher = (plan: CatalogPlan, vigente: CatalogPlan) => {
    setTier(passoDoPlano(product, plan.key, tier));
    setConfirming(vigente);
  };

  const goToCheckout = (plan: CatalogPlan) => {
    // O passo vai junto porque é ele que define o preço; o servidor
    // recalcula a partir do par (plano, passo) e nunca confia no valor da tela.
    window.location.href = `/checkout?product=${product}&plan=${plan.key}&tier=${tier}`;
  };

  const gridCols =
    plans.length >= 4
      ? "lg:grid-cols-4"
      : plans.length === 3
        ? "lg:grid-cols-3"
        : "lg:grid-cols-2";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setConfirming(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[92vh] w-[min(1240px,96vw)] max-w-none overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Planos</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-center text-sm text-muted-foreground">
          Você está no{" "}
          <span className="font-medium text-foreground">
            {billingState.data?.planName ?? "Free"}
          </span>
          . Arraste para ver o plano que atende o seu volume.
        </p>

        {/* Toggle produto */}
        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-1">
            <button
              onClick={() => switchProduct("transactional")}
              className={`rounded-full px-5 py-2 text-sm transition-all ${
                product === "transactional"
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              E-mails transacionais
            </button>
            <button
              onClick={() => switchProduct("marketing")}
              className={`rounded-full px-5 py-2 text-sm transition-all ${
                product === "marketing"
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              E-mails de marketing
            </button>
          </div>
        </div>

        {/* Slider de volume */}
        <div className="mx-auto mt-6 w-full max-w-3xl px-2">
          <input
            type="range"
            min={0}
            max={tiers.length - 1}
            value={tier}
            onChange={(e) => setTier(Number(e.target.value))}
            className="w-full accent-foreground"
            aria-label={
              product === "transactional"
                ? "E-mails por mês"
                : "Número de contatos"
            }
            aria-valuetext={tiers[tier]}
          />
          <div
            className="mt-2 grid text-center"
            style={{ gridTemplateColumns: `repeat(${tiers.length}, 1fr)` }}
          >
            {tiers.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(i)}
                className={`text-[11px] transition-colors ${
                  i === tier
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {product === "transactional"
              ? `Até ${tiers[tier]} e-mails por mês`
              : `Até ${tiers[tier]} contatos`}
          </p>
        </div>

        {confirming ? (
          <ConfirmPanel
            current={currentPlan}
            next={confirming}
            onCancel={() => setConfirming(null)}
            onConfirm={() => goToCheckout(confirming)}
          />
        ) : (
          <div
            className={`mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 ${gridCols}`}
          >
            {plans.map((plan) => {
              const estado = estadoDoCard(
                product,
                plan.key,
                tier,
                plan.priceBRL,
                plan.volume,
              );
              const vigente: CatalogPlan = {
                ...plan,
                priceBRL: estado.precoBRL,
                volume: estado.volume,
                extra: estado.extra ?? plan.extra,
              };
              const isCurrent =
                plan.key === planKeyAtual && product === produtoAtual;
              const isCustom = estado.precoBRL === null;
              return (
                <div
                  key={plan.key}
                  className={`relative flex flex-col rounded-2xl border p-6 transition-opacity ${
                    estado.recomendado
                      ? "border-foreground/40 bg-muted/30 shadow-lg"
                      : ""
                  } ${estado.esmaecido ? "opacity-40" : ""}`}
                >
                  <div className="text-center text-sm font-medium text-muted-foreground">
                    {plan.name}
                  </div>
                  {isCurrent ? (
                    <div className="mt-2 text-center">
                      <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Seu plano
                      </span>
                    </div>
                  ) : estado.recomendado ? (
                    <div className="mt-2 text-center">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                        Recomendado
                      </span>
                    </div>
                  ) : null}
                  <div className="py-5 text-center">
                    <span className="text-4xl font-semibold tracking-tight">
                      {priceLabel(vigente)}
                    </span>
                    {estado.precoBRL !== null ? (
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        / mês
                      </span>
                    ) : null}
                  </div>
                  <div className="min-h-[64px] border-y py-4 text-center">
                    <p className="text-sm font-medium">{estado.volume}</p>
                    {estado.extra ?? plan.extra ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {estado.extra ?? plan.extra}
                      </p>
                    ) : null}
                  </div>
                  <ul className="flex-1 space-y-3 py-6">
                    {plan.features.map((f) => (
                      <li
                        key={f.label}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        {f.ok ? (
                          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <X className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                        )}
                        <span className={f.ok ? "" : "text-muted-foreground"}>
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : isCustom ? (
                    <Button variant="outline" className="w-full" asChild>
                      <a href="mailto:contato@madmail.com.br">Fale conosco</a>
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={estado.recomendado ? "default" : "outline"}
                      onClick={() => escolher(plan, vigente)}
                    >
                      Mudar para R$ {estado.precoBRL?.toLocaleString("pt-BR")} /
                      mês
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmPanel({
  current,
  next,
  onCancel,
  onConfirm,
}: {
  current: CatalogPlan;
  next: CatalogPlan;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;
  const diff = (next.priceBRL ?? 0) - (current.priceBRL ?? 0);
  return (
    <div className="mx-auto mt-10 w-full max-w-md rounded-2xl border p-8 shadow-lg">
      <h3 className="text-lg font-semibold">Fazer upgrade do plano</h3>

      <div className="mt-5 space-y-4 text-sm">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="text-xs text-muted-foreground">Plano atual</div>
            <div className="mt-0.5 font-medium">
              {current.name} · {current.volume}
            </div>
          </div>
          <span className="font-mono">{brl(current.priceBRL ?? 0)} / mês</span>
        </div>
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="text-xs text-muted-foreground">Novo plano</div>
            <div className="mt-0.5 font-medium">
              {next.name} · {next.volume}
            </div>
          </div>
          <span className="font-mono">{brl(next.priceBRL ?? 0)} / mês</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Diferença mensal</span>
          <span className="font-mono font-semibold">
            {diff >= 0 ? "+" : "−"}
            {brl(Math.abs(diff))} / mês
          </span>
        </div>
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Você será cobrado hoje e a partir daí {brl(next.priceBRL ?? 0)} por mês
        a cada ciclo.
      </p>

      <div className="mt-6 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={onConfirm}>
          Confirmar upgrade
        </Button>
      </div>
    </div>
  );
}
