"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@usesend/ui/src/button";

// Links de produto — confirmar domínios finais com o time.
const APP_URL = "https://app.madmail.com.br";
const LOGIN_URL = `${APP_URL}/login`;
const SIGNUP_URL = `${APP_URL}/cadastro`;
const DOCS_URL = "https://docs.madmail.com.br";

type MenuItem = { label: string; desc?: string; href: string };

const FEATURES: MenuItem[] = [
  { label: "Email API", desc: "Dispare transacionais via API", href: "/features/email-api" },
  { label: "SMTP", desc: "Relay que pluga em qualquer app", href: "/features/smtp" },
  { label: "Editor", desc: "Monte campanhas sem código", href: "/features/editor" },
  { label: "Templates", desc: "Reuse marca e blocos", href: "/features/templates" },
  { label: "Automações", desc: "Fluxos e disparos agendados", href: "/features/automacoes" },
  { label: "Contatos", desc: "Listas, consentimento e segmentos", href: "/features/contatos" },
  { label: "Webhooks", desc: "Eventos em tempo real", href: "/features/webhooks" },
  { label: "Entregabilidade", desc: "Caixa de entrada, não spam", href: "/features/entregabilidade" },
];

const AI_ITEMS: MenuItem[] = [
  { label: "Madmail no ChatGPT", desc: "Crie campanhas conversando", href: "/ai" },
  { label: "Conector MCP", desc: "Ligue seu assistente ao Madmail", href: "/ai#mcp" },
  { label: "Automação por IA", desc: "Segmente e agende falando", href: "/ai" },
];

function Dropdown({
  label,
  items,
  cols = 1,
}: {
  label: string;
  items: MenuItem[];
  cols?: 1 | 2;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="flex items-center gap-1 py-2 hover:text-foreground"
        aria-expanded={open}
      >
        {label}
        <svg
          viewBox="0 0 24 24"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
          <div
            className={`rounded-2xl border border-border bg-background p-2 shadow-2xl ${
              cols === 2 ? "grid w-[460px] grid-cols-2 gap-1" : "w-[300px]"
            }`}
          >
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="block rounded-lg px-3 py-2 hover:bg-accent"
              >
                <div className="text-foreground">{it.label}</div>
                {it.desc ? (
                  <div className="text-xs text-muted-foreground">{it.desc}</div>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TopNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const pricingHref = isHome ? "#pricing" : "/pricing";

  return (
    <header className="sticky top-0 z-30 border-b border-border py-4 backdrop-blur supports-[backdrop-filter]:bg-sidebar-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 text-sm">
        <Link href="/" className="group flex items-center" aria-label="Madmail">
          {/* Wordmark — bloco claro no tema escuro, bloco escuro no tema claro */}
          <Image
            src="/brand/madmail-wordmark-light.svg"
            alt="Madmail"
            width={116}
            height={22}
            className="block h-5 w-auto dark:hidden"
            priority
          />
          <Image
            src="/brand/madmail-wordmark-dark.svg"
            alt="Madmail"
            width={116}
            height={22}
            className="hidden h-5 w-auto dark:block"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 text-muted-foreground lg:flex">
          <Dropdown label="Features" items={FEATURES} cols={2} />
          <Dropdown label="IA" items={AI_ITEMS} />
          <a href={DOCS_URL} className="py-2 hover:text-foreground">
            Docs
          </a>
          <Link href={pricingHref} className="py-2 hover:text-foreground">
            Preços
          </Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a href={LOGIN_URL} className="text-muted-foreground hover:text-foreground">
            Entrar
          </a>
          <Button size="sm">
            <a href={SIGNUP_URL}>Criar sua conta</a>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          aria-label="Abrir menu"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
            {open ? (
              <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu panel */}
      {open ? (
        <div className="border-t border-border bg-sidebar-background/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-3 text-sm">
            {[...FEATURES.slice(0, 4), ...AI_ITEMS.slice(0, 1)].map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="py-2 text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {it.label}
              </Link>
            ))}
            <a href={DOCS_URL} className="py-2 text-muted-foreground hover:text-foreground">
              Docs
            </a>
            <Link href={pricingHref} className="py-2 text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
              Preços
            </Link>
            <div className="mt-2 flex flex-col gap-2">
              <a href={LOGIN_URL} className="py-2 text-muted-foreground hover:text-foreground">
                Entrar
              </a>
              <Button className="w-full">
                <a href={SIGNUP_URL}>Criar sua conta</a>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
