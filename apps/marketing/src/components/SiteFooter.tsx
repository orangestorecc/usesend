import Image from "next/image";
import Link from "next/link";
// Replaced StatusBadge with external status badge image

const APP_URL = "https://app.madmail.com.br";

export function SiteFooter() {
  return (
    <footer className="py-10 border-t border-border">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-center sm:w-56">
            <Image
              src="/brand/madmail-wordmark-light.svg"
              alt="Madmail"
              width={120}
              height={22}
              className="block h-5 w-auto dark:hidden"
            />
            <Image
              src="/brand/madmail-wordmark-dark.svg"
              alt="Madmail"
              width={120}
              height={22}
              className="hidden h-5 w-auto dark:block"
            />
          </div>

          <div className="sm:ml-auto flex items-start gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-2 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider mb-2">
                  Produto
                </div>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    <a
                      href={APP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground text-xs"
                    >
                      Dashboard
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://docs.madmail.com.br"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground text-xs"
                    >
                      Docs
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider  mb-2">
                  Contato
                </div>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    <a
                      href="mailto:contato@madmail.com.br"
                      className="hover:text-foreground text-xs"
                    >
                      Email
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://x.com/Madmail_com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground text-xs"
                    >
                      X (Twitter)
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.linkedin.com/company/use-send/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground text-xs"
                    >
                      LinkedIn
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://discord.com/invite/BU8n8pJv8S"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground text-xs"
                    >
                      Discord
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://bsky.app/profile/usesend.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground text-xs"
                    >
                      Bluesky
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider mb-2">
                  Empresa
                </div>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    <Link
                      href="/sobre"
                      className="hover:text-foreground text-xs"
                    >
                      Sobre
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/privacidade"
                      className="hover:text-foreground text-xs"
                    >
                      Privacidade
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/termos"
                      className="hover:text-foreground text-xs"
                    >
                      Termos
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <a
              href="https://status.madmail.com.br/status/madmail"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Status do serviço"
              title="Status do serviço"
              className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Status
            </a>
          </div>
        </div>

        <div className="mt-6 text-xs text-muted-foreground mx-auto text-center">
          © {new Date().getFullYear()} Madmail. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
