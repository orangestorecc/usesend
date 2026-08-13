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
                    <a
                      href="mailto:contato@madmail.com.br"
                      className="hover:text-foreground text-xs"
                    >
                      Fale conosco
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider mb-2">
                  Legal
                </div>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    <Link
                      href="/legal/termos-de-uso"
                      className="hover:text-foreground text-xs"
                    >
                      Termos de Uso
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/legal/politica-de-privacidade"
                      className="hover:text-foreground text-xs"
                    >
                      Política de Privacidade
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/legal/politica-de-uso-aceitavel"
                      className="hover:text-foreground text-xs"
                    >
                      Política de Uso Aceitável
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/legal/dpa"
                      className="hover:text-foreground text-xs"
                    >
                      Tratamento de Dados (DPA)
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/legal/suboperadores"
                      className="hover:text-foreground text-xs"
                    >
                      Suboperadores
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
          © {new Date().getFullYear()} Madmail · N49 Tecnologia · CNPJ
          10.911.509/0001-40 · Porto Alegre, RS. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
