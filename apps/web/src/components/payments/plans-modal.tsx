"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { Button } from "@usesend/ui/src/button";
import { Check, X } from "lucide-react";
import { api } from "~/trpc/react";
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
  const plans: CatalogPlan[] =
    (product === "transactional"
      ? catalogQuery.data?.transactional
      : catalogQuery.data?.marketing) ??
    (product === "transactional" ? TRANSACTIONAL_PLANS : MARKETING_PLANS);

  const tiers = product === "transactional" ? TRANSACTIONAL_TIERS : MARKETING_TIERS;
  const currentPlan = plans.find((p) => p.priceBRL === 0) ?? plans[0]!;

  const switchProduct = (p: Product) => {
    setProduct(p);
    setTier(0);
    setConfirming(null);
  };

  const goToCheckout = (plan: CatalogPlan) => {
    window.location.href = `/checkout?product=${product}&plan=${plan.key}`;
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

        {/* Toggle produto */}
        <div className="mt-2 flex justify-center">
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
          />
          <div
            className="mt-2 grid text-center"
            style={{ gridTemplateColumns: `repeat(${tiers.length}, 1fr)` }}
          >
            {tiers.map((t, i) => (
              <span
                key={t}
                className={`text-[11px] ${
                  i === tier
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
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
              const isCurrent = plan.priceBRL === 0;
              const isCustom = plan.priceBRL === null;
              return (
                <div
                  key={plan.key}
                  className={`flex flex-col rounded-2xl border p-6 ${
                    plan.highlight ? "border-foreground/40 shadow-lg" : ""
                  }`}
                >
                  <div className="text-center text-sm font-medium text-muted-foreground">
                    {plan.name}
                  </div>
                  <div className="py-5 text-center">
                    <span className="text-4xl font-semibold tracking-tight">
                      {priceLabel(plan)}
                    </span>
                    {plan.priceBRL !== null ? (
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        / mês
                      </span>
                    ) : null}
                  </div>
                  <div className="min-h-[64px] border-y py-4 text-center">
                    <p className="text-sm font-medium">{plan.volume}</p>
                    {plan.extra ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {plan.extra}
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
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => setConfirming(plan)}
                    >
                      Mudar para R$ {plan.priceBRL} / mês
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
          <span className="font-mono">R$ {current.priceBRL ?? 0} / mês</span>
        </div>
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="text-xs text-muted-foreground">Novo plano</div>
            <div className="mt-0.5 font-medium">
              {next.name} · {next.volume}
            </div>
          </div>
          <span className="font-mono">R$ {next.priceBRL ?? 0} / mês</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Diferença mensal</span>
          <span className="font-mono font-semibold">
            {diff >= 0 ? "+" : ""}R$ {diff} / mês
          </span>
        </div>
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Você será cobrado hoje e a partir daí R$ {next.priceBRL} por mês a cada
        ciclo.
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
