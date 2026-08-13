import { NextResponse } from "next/server";

import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { buildDnsInstructionsMarkdown } from "~/server/service/dns-instructions";

/**
 * Instruções de DNS para o cliente repassar ao técnico dele.
 *
 * `format=md` baixa o arquivo; `format=print` abre uma página já formatada que
 * dispara a impressão — é assim que o cliente gera o PDF sem precisarmos
 * embarcar um renderizador de PDF no servidor.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const { domainId } = await params;
  const id = Number(domainId);

  if (!Number.isInteger(id)) {
    return new NextResponse("Domínio inválido", { status: 400 });
  }

  const teamUser = await db.teamUser.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  });

  if (!teamUser) {
    return new NextResponse("Time não encontrado", { status: 404 });
  }

  let markdown: string;

  try {
    markdown = await buildDnsInstructionsMarkdown({
      domainId: id,
      teamId: teamUser.team.id,
      teamName: teamUser.team.name,
    });
  } catch {
    return new NextResponse("Domínio não encontrado", { status: 404 });
  }

  const formato = new URL(request.url).searchParams.get("format") ?? "md";

  if (formato === "print") {
    return new NextResponse(paginaParaImpressao(markdown), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="configuracao-dns-${id}.md"`,
      "Cache-Control": "no-store",
    },
  });
}

function escaparHtml(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Renderiza o subconjunto de markdown que o gerador produz (títulos, tabelas,
 * listas, código e negrito). Não é um parser genérico — é só o suficiente para
 * este documento, e por isso não vale trazer uma dependência.
 */
function paginaParaImpressao(markdown: string) {
  const linhas = markdown.split("\n");
  const html: string[] = [];
  let emTabela = false;
  let emLista = false;

  const fecharLista = () => {
    if (emLista) {
      html.push("</ul>");
      emLista = false;
    }
  };

  const fecharTabela = () => {
    if (emTabela) {
      html.push("</tbody></table>");
      emTabela = false;
    }
  };

  const inline = (texto: string) =>
    escaparHtml(texto)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  for (const linha of linhas) {
    const texto = linha.trim();

    if (texto.length === 0) {
      fecharLista();
      fecharTabela();
      continue;
    }

    if (texto.startsWith("|")) {
      const celulas = texto
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      // Linha separadora do cabeçalho markdown (| --- | --- |)
      if (celulas.every((c) => /^-+$/.test(c))) {
        continue;
      }

      if (!emTabela) {
        emTabela = true;
        html.push("<table><thead><tr>");
        html.push(celulas.map((c) => `<th>${inline(c)}</th>`).join(""));
        html.push("</tr></thead><tbody>");
        continue;
      }

      html.push(
        `<tr>${celulas.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`,
      );
      continue;
    }

    fecharTabela();

    if (texto.startsWith("- ")) {
      if (!emLista) {
        html.push("<ul>");
        emLista = true;
      }
      html.push(`<li>${inline(texto.slice(2))}</li>`);
      continue;
    }

    fecharLista();

    const titulo = texto.match(/^(#{1,3})\s+(.*)$/);
    if (titulo?.[1] && titulo[2]) {
      const nivel = titulo[1].length;
      html.push(`<h${nivel}>${inline(titulo[2])}</h${nivel}>`);
      continue;
    }

    if (texto === "---") {
      html.push("<hr />");
      continue;
    }

    html.push(`<p>${inline(texto)}</p>`);
  }

  fecharLista();
  fecharTabela();

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Configuração de DNS — Madmail</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 46rem;
         margin: 2.5rem auto; padding: 0 1.5rem; color: #111; line-height: 1.6; }
  h1 { font-size: 1.6rem; } h2 { font-size: 1.2rem; margin-top: 2rem; }
  h3 { font-size: 1rem; margin-top: 1.5rem; }
  table { border-collapse: collapse; width: 100%; margin: .75rem 0; font-size: .82rem; }
  th, td { border: 1px solid #ddd; padding: .45rem .6rem; text-align: left;
           word-break: break-all; }
  th { background: #f5f5f5; }
  code { background: #f2f2f2; padding: .1rem .3rem; border-radius: 3px;
         font-size: .82rem; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
${html.join("\n")}
<script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;
}
