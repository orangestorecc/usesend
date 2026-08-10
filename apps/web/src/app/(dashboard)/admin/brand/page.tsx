"use client";

import { useRef } from "react";
import { Download, FileText, ExternalLink } from "lucide-react";
import { Button } from "@usesend/ui/src/button";

const BRANDBOOK_HTML = "/brand/madmail-brandbook.html";

export default function BrandPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrintPdf = () => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) {
      // fallback: abre em nova aba pra imprimir
      window.open(BRANDBOOK_HTML, "_blank")?.focus();
      return;
    }
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Brand</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Brandbook oficial da Madmail — personalidade, logo, cor,
            tipografia, o gesto da marca, endosso N49 e o checklist antes de
            publicar. Fonte única para todo o time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="default">
            <a href={BRANDBOOK_HTML} download="madmail-brandbook.html">
              <Download className="mr-1.5 h-3.5 w-3.5" /> HTML
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrintPdf}>
            <FileText className="mr-1.5 h-3.5 w-3.5" /> PDF
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href={BRANDBOOK_HTML} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir
            </a>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <iframe
          ref={iframeRef}
          src={BRANDBOOK_HTML}
          title="Madmail Brandbook"
          className="h-[80vh] w-full"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Dica: para salvar em PDF, use o botão <strong>PDF</strong> e escolha
        “Salvar como PDF” no destino de impressão.
      </p>
    </div>
  );
}
