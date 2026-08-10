"use client";

import { useEffect, useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { Switch } from "@usesend/ui/src/switch";
import { Spinner } from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";
import { Check } from "lucide-react";
import { api } from "~/trpc/react";

type State = {
  logoUrl: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  hideBranding: boolean;
  prefsTitle: string;
  prefsSubtitle: string;
  unsubButtonLabel: string;
  successTitle: string;
};

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 font-mono text-xs"
        />
      </div>
    </div>
  );
}

function Preview({ s, mode }: { s: State; mode: "prefs" | "success" }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center"
      style={{ background: s.bgColor, color: s.textColor }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: s.accentColor }}
      >
        <Check className="h-6 w-6" style={{ color: s.textColor }} />
      </div>
      {mode === "prefs" ? (
        <>
          <h1 className="mt-6 text-2xl font-bold">{s.prefsTitle}</h1>
          <p className="mt-1 text-sm opacity-70">{s.prefsSubtitle}</p>
          <div
            className="mt-6 rounded-lg px-10 py-3 text-sm font-medium"
            style={{ background: s.accentColor }}
          >
            {s.unsubButtonLabel}
          </div>
        </>
      ) : (
        <h1 className="mt-6 text-2xl font-bold">{s.successTitle}</h1>
      )}
      {!s.hideBranding ? (
        <p className="mt-8 text-xs opacity-50">Desenvolvido por Madmail</p>
      ) : null}
    </div>
  );
}

export default function UnsubscribePageSettings() {
  const utils = api.useUtils();
  const query = api.unsubscribePage.get.useQuery();
  const update = api.unsubscribePage.update.useMutation();
  const [mode, setMode] = useState<"prefs" | "success">("prefs");
  const [s, setS] = useState<State | null>(null);

  useEffect(() => {
    const d = query.data;
    if (!d) return;
    setS({
      logoUrl: d.logoUrl ?? "",
      bgColor: d.bgColor,
      textColor: d.textColor,
      accentColor: d.accentColor,
      hideBranding: d.hideBranding,
      prefsTitle: d.prefsTitle,
      prefsSubtitle: d.prefsSubtitle,
      unsubButtonLabel: d.unsubButtonLabel,
      successTitle: d.successTitle,
    });
  }, [query.data]);

  if (!s) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const set = (patch: Partial<State>) => setS({ ...s, ...patch });

  const save = () => {
    update.mutate(
      { ...s, logoUrl: s.logoUrl || null },
      {
        onSuccess: () => {
          utils.unsubscribePage.get.invalidate();
          toast.success("Página de descadastramento salva.");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* Preview */}
      <div className="rounded-xl border p-4 shadow-sm">
        <div className="mb-3 flex gap-2">
          <Button
            size="sm"
            variant={mode === "prefs" ? "secondary" : "ghost"}
            onClick={() => setMode("prefs")}
          >
            Preferências
          </Button>
          <Button
            size="sm"
            variant={mode === "success" ? "secondary" : "ghost"}
            onClick={() => setMode("success")}
          >
            Sucesso
          </Button>
        </div>
        <Preview s={s} mode={mode} />
      </div>

      {/* Editor */}
      <div className="space-y-5 rounded-xl border p-4 shadow-sm">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cores
          </div>
          <div className="space-y-2">
            <ColorField
              label="Fundo"
              value={s.bgColor}
              onChange={(v) => set({ bgColor: v })}
            />
            <ColorField
              label="Texto"
              value={s.textColor}
              onChange={(v) => set({ textColor: v })}
            />
            <ColorField
              label="Destaque"
              value={s.accentColor}
              onChange={(v) => set({ accentColor: v })}
            />
          </div>
        </div>

        <div>
          <Label>Logo (URL)</Label>
          <Input
            className="mt-1"
            value={s.logoUrl}
            placeholder="https://..."
            onChange={(e) => set({ logoUrl: e.target.value })}
          />
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Textos
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Título (preferências)</Label>
              <Input
                className="mt-1"
                value={s.prefsTitle}
                onChange={(e) => set({ prefsTitle: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Subtítulo</Label>
              <Input
                className="mt-1"
                value={s.prefsSubtitle}
                onChange={(e) => set({ prefsSubtitle: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Botão de cancelar</Label>
              <Input
                className="mt-1"
                value={s.unsubButtonLabel}
                onChange={(e) => set({ unsubButtonLabel: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Título de sucesso</Label>
              <Input
                className="mt-1"
                value={s.successTitle}
                onChange={(e) => set({ successTitle: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label>Ocultar branding</Label>
          <Switch
            checked={s.hideBranding}
            onCheckedChange={(v) => set({ hideBranding: v })}
          />
        </div>

        <Button className="w-full" onClick={save} disabled={update.isPending}>
          {update.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
