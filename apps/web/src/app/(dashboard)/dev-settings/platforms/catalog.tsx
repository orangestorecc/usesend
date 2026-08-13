"use client";

import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";

/**
 * Catálogo de plataformas integráveis.
 *
 * As disponíveis levam ao fluxo de conexão; as demais ficam visíveis como
 * "em breve" de propósito — deixa claro o que vem por aí e evita a pergunta
 * "vocês integram com X?". Os detalhes de cada uma ficam na documentação.
 */
export type PlataformaCatalogo = {
  id: string;
  nome: string;
  descricao: string;
  disponivel: boolean;
  /** Caminho na documentação, quando houver. */
  docs?: string;
};

export const PLATAFORMAS: PlataformaCatalogo[] = [
  {
    id: "orangestore",
    nome: "OrangeStore",
    descricao:
      "Importa os clientes da sua loja e mantém a lista de contatos em dia.",
    disponivel: true,
    docs: "/guides/orangestore",
  },
  {
    id: "shopify",
    nome: "Shopify",
    descricao:
      "Sincroniza clientes e pedidos para segmentar por compra e recuperar carrinho.",
    disponivel: false,
  },
  {
    id: "vtex",
    nome: "VTEX",
    descricao:
      "Integração com o catálogo e a base de clientes de operações VTEX.",
    disponivel: false,
  },
  {
    id: "wbuy",
    nome: "Wbuy",
    descricao: "Traz os clientes da sua loja Wbuy para as listas de contatos.",
    disponivel: false,
  },
  {
    id: "woocommerce",
    nome: "WooCommerce",
    descricao:
      "Conecta sua loja WordPress e importa clientes e histórico de pedidos.",
    disponivel: false,
  },
  {
    id: "nuvemshop",
    nome: "Nuvemshop",
    descricao:
      "Sincroniza a base de clientes da Nuvemshop com as suas listas.",
    disponivel: false,
  },
];

const DOCS_BASE = "https://docs.madmail.com.br";

export function CatalogoPlataformas({
  onConectar,
}: {
  onConectar?: (id: string) => void;
}) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold">Plataformas disponíveis</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Conecte sua loja para importar clientes automaticamente.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATAFORMAS.map((p) => (
          <div
            key={p.id}
            className={`flex flex-col rounded-xl border p-4 transition-colors ${
              p.disponivel ? "hover:border-foreground/30" : "opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{p.nome}</span>
              {p.disponivel ? (
                <Badge variant="outline">disponível</Badge>
              ) : (
                <Badge variant="secondary">em breve</Badge>
              )}
            </div>

            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {p.descricao}
            </p>

            <div className="mt-3 flex items-center gap-3">
              {p.disponivel && onConectar ? (
                <Button size="sm" onClick={() => onConectar(p.id)}>
                  <PlusIcon className="mr-1 h-3.5 w-3.5" />
                  Adicionar integração
                </Button>
              ) : null}
              {p.docs ? (
                <a
                  href={`${DOCS_BASE}${p.docs}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Documentação
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Precisa de uma integração que não está aqui? Fale com o suporte — a
        ordem de desenvolvimento segue a demanda dos clientes.
      </p>
    </div>
  );
}
