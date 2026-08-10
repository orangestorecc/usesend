"use client";

import Image from "next/image";
import { Download } from "lucide-react";
import { Button } from "@usesend/ui/src/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@usesend/ui/src/card";

type Asset = {
  id: string;
  title: string;
  description: string;
  /** preview background */
  bg: "dark" | "light";
  /** intrinsic aspect for the preview */
  wide?: boolean;
  svg?: string;
  png: string;
  /** extra png sizes available for download */
  pngSizes?: { label: string; href: string }[];
};

const BRAND = "/brand";

const ASSETS: Asset[] = [
  {
    id: "wordmark-dark",
    title: "Wordmark — fundo escuro",
    description: "Versão padrão. Bloco branco “MAD” + “MAIL” em branco.",
    bg: "dark",
    wide: true,
    svg: `${BRAND}/madmail-wordmark-dark.svg`,
    png: `${BRAND}/madmail-wordmark-dark.png`,
  },
  {
    id: "wordmark-light",
    title: "Wordmark — fundo claro",
    description: "Bloco preto “MAD” + “MAIL” em tinta. Para superfícies claras.",
    bg: "light",
    wide: true,
    svg: `${BRAND}/madmail-wordmark-light.svg`,
    png: `${BRAND}/madmail-wordmark-light.png`,
  },
  {
    id: "symbol",
    title: "Símbolo — fundo escuro",
    description: "App icon, favicon, avatar. Quadrado branco, “M” preto.",
    bg: "dark",
    svg: `${BRAND}/madmail-symbol.svg`,
    png: `${BRAND}/madmail-symbol.png`,
    pngSizes: [
      { label: "favicon.ico", href: `${BRAND}/madmail.ico` },
      { label: "512", href: `${BRAND}/madmail-icon-512.png` },
      { label: "256", href: `${BRAND}/madmail-icon-256.png` },
      { label: "128", href: `${BRAND}/madmail-icon-128.png` },
      { label: "64", href: `${BRAND}/madmail-icon-64.png` },
      { label: "48", href: `${BRAND}/madmail-icon-48.png` },
      { label: "32", href: `${BRAND}/madmail-icon-32.png` },
    ],
  },
  {
    id: "symbol-light",
    title: "Símbolo — fundo claro",
    description: "Versão invertida do símbolo para superfícies claras.",
    bg: "light",
    svg: `${BRAND}/madmail-symbol-light.svg`,
    png: `${BRAND}/madmail-symbol-light.png`,
  },
  {
    id: "lockup-n49",
    title: "Lockup — endosso N49",
    description: "Wordmark + separador + N49. Uma vez por peça.",
    bg: "dark",
    wide: true,
    svg: `${BRAND}/madmail-lockup-n49-dark.svg`,
    png: `${BRAND}/madmail-lockup-n49-dark.png`,
  },
];

const COLORS: { name: string; value: string; role: string }[] = [
  { name: "Preto", value: "#000000", role: "Fundo padrão" },
  { name: "Superfície", value: "#0A0A0A", role: "Cartões, campos" },
  { name: "Near White", value: "#FAFAFA", role: "Texto, CTA" },
  { name: "Silver", value: "#A1A1A1", role: "Texto secundário" },
  { name: "Gray", value: "#6B6B6B", role: "Captions, meta" },
  { name: "Success", value: "#3F9E6A", role: "Estado (produto)" },
  { name: "Warn", value: "#C99A3B", role: "Estado (produto)" },
  { name: "Danger", value: "#C0524A", role: "Estado (produto)" },
];

function DownloadLink({
  href,
  children,
  variant = "outline",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "outline" | "default" | "secondary";
}) {
  const name = href.split("/").pop() ?? "download";
  return (
    <Button asChild size="sm" variant={variant}>
      <a href={href} download={name}>
        {children}
      </a>
    </Button>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="flex flex-col gap-8 pb-16">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Design System</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Logos, cores e tipografia da marca Madmail — monocromático, estilo
          Resend. Baixe SVG (vetorial, editável) ou PNG (transparente).
        </p>
      </div>

      {/* Logos */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ASSETS.map((a) => (
          <Card key={a.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{a.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{a.description}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div
                className="flex min-h-[160px] items-center justify-center rounded-lg border p-8"
                style={{
                  background: a.bg === "dark" ? "#000000" : "#FAFAFA",
                  borderColor:
                    a.bg === "dark"
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(0,0,0,0.10)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.svg ?? a.png}
                  alt={a.title}
                  className="max-h-[110px] w-auto max-w-full"
                  style={a.wide ? { maxWidth: "80%" } : { maxHeight: 96 }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {a.svg ? (
                  <DownloadLink href={a.svg} variant="default">
                    <Download className="mr-1.5 h-3.5 w-3.5" /> SVG
                  </DownloadLink>
                ) : null}
                <DownloadLink href={a.png}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> PNG
                </DownloadLink>
                {a.pngSizes ? (
                  <div className="ml-1 flex flex-wrap items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      ícone:
                    </span>
                    {a.pngSizes.map((s) => (
                      <Button
                        key={s.href}
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                      >
                        <a href={s.href} download={s.href.split("/").pop()}>
                          {s.label}
                        </a>
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paleta</CardTitle>
          <p className="text-sm text-muted-foreground">
            Monocromática. Cores de estado só dentro do produto — nunca na
            marca.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COLORS.map((c) => (
              <div key={c.value} className="rounded-lg border p-3">
                <div
                  className="mb-2 h-12 w-full rounded-md border"
                  style={{
                    background: c.value,
                    borderColor: "rgba(127,127,127,0.25)",
                  }}
                />
                <div className="text-sm font-medium">{c.name}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {c.value}
                </div>
                <div className="text-xs text-muted-foreground">{c.role}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tipografia */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipografia</CardTitle>
          <p className="text-sm text-muted-foreground">
            Inter para texto e títulos; JetBrains Mono para prompts, código e
            dados.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Inter — display / body
            </div>
            <div
              className="mt-1 text-4xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Dispare conversando
            </div>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              JetBrains Mono — prompts / dados
            </div>
            <div
              className="mt-1 text-2xl"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              &gt; segmente quem comprou nos últimos 90 dias
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
