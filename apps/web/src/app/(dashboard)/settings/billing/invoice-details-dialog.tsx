"use client";

import { format } from "date-fns";
import {
  Banknote,
  CreditCard,
  Download,
  FileText,
  QrCode,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { Button } from "@usesend/ui/src/button";
import { TextWithCopyButton } from "@usesend/ui/src/text-with-copy";
import Spinner from "@usesend/ui/src/spinner";
import { api } from "~/trpc/react";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const METODO_LABEL: Record<string, string> = {
  card: "Cartão de crédito",
  pix: "PIX",
  boleto: "Boleto bancário",
};

function Linha({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function InvoiceDetailsDialog({
  invoiceId,
  onOpenChange,
}: {
  invoiceId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const query = api.billingProfile.invoice.useQuery(
    { invoiceId: invoiceId ?? "" },
    { enabled: Boolean(invoiceId) },
  );

  const fatura = query.data;
  // A cobrança que quitou a fatura manda; se nenhuma foi paga, mostramos a
  // mais recente, que é a que tem o boleto/QR ainda válido.
  const cobranca =
    fatura?.charges.find((c) => c.status === "paid") ?? fatura?.charges[0];

  return (
    <Dialog open={Boolean(invoiceId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {fatura ? `Fatura ${fatura.number}` : "Detalhes da fatura"}
          </DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" innerSvgClass="stroke-primary" />
          </div>
        ) : !fatura ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar esta fatura.
          </p>
        ) : (
          <div className="divide-y">
            <div className="pb-2">
              <Linha rotulo="Descrição">
                {fatura.description ?? "Assinatura"}
              </Linha>
              <Linha rotulo="Valor">
                <span className="font-mono">{brl(fatura.amountCents)}</span>
              </Linha>
              <Linha rotulo="Emitida em">
                {format(new Date(fatura.issuedAt), "dd/MM/yyyy")}
              </Linha>
              {fatura.dueAt ? (
                <Linha rotulo="Vencimento">
                  {format(new Date(fatura.dueAt), "dd/MM/yyyy")}
                </Linha>
              ) : null}
              {fatura.paidAt ? (
                <Linha rotulo="Paga em">
                  {format(new Date(fatura.paidAt), "dd/MM/yyyy 'às' HH:mm")}
                </Linha>
              ) : null}
            </div>

            {/* Forma de pagamento e comprovantes */}
            {cobranca ? (
              <div className="py-2">
                <Linha rotulo="Forma de pagamento">
                  <span className="inline-flex items-center gap-1.5">
                    {cobranca.method === "card" ? (
                      <CreditCard className="h-4 w-4" />
                    ) : cobranca.method === "pix" ? (
                      <QrCode className="h-4 w-4" />
                    ) : (
                      <Banknote className="h-4 w-4" />
                    )}
                    {METODO_LABEL[cobranca.method] ?? cobranca.method}
                  </span>
                </Linha>

                {cobranca.method === "card" && cobranca.cardLast4 ? (
                  <Linha rotulo="Cartão">
                    {cobranca.cardBrand ? `${cobranca.cardBrand} ` : ""}
                    •••• {cobranca.cardLast4}
                  </Linha>
                ) : null}

                {cobranca.boletoBarcode ? (
                  <Linha rotulo="Linha digitável">
                    <TextWithCopyButton
                      value={cobranca.boletoBarcode}
                      className="font-mono text-xs"
                    />
                  </Linha>
                ) : null}

                {cobranca.pixQrCode ? (
                  <div className="py-2">
                    <p className="mb-2 text-sm text-muted-foreground">
                      PIX copia e cola
                    </p>
                    <TextWithCopyButton
                      value={cobranca.pixQrCode}
                      className="font-mono text-xs break-all"
                    />
                    {cobranca.pixQrImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          cobranca.pixQrImage.startsWith("data:")
                            ? cobranca.pixQrImage
                            : `data:image/png;base64,${cobranca.pixQrImage}`
                        }
                        alt="QR Code do PIX"
                        className="mt-3 h-40 w-40 rounded-lg border bg-white p-2"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                Nenhuma cobrança registrada para esta fatura.
              </p>
            )}

            {/* Documentos */}
            <div className="flex flex-wrap gap-2 pt-4">
              {fatura.pdfUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={fatura.pdfUrl} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar fatura
                  </a>
                </Button>
              ) : null}

              {cobranca?.boletoUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={cobranca.boletoUrl} target="_blank" rel="noreferrer">
                    <Banknote className="mr-2 h-4 w-4" />
                    Baixar boleto
                  </a>
                </Button>
              ) : null}

              {fatura.nfStatus === "issued" && fatura.nfUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={fatura.nfUrl} target="_blank" rel="noreferrer">
                    <FileText className="mr-2 h-4 w-4" />
                    Nota fiscal
                    {fatura.nfNumber ? ` ${fatura.nfNumber}` : ""}
                  </a>
                </Button>
              ) : fatura.nfStatus === "not_applicable" ? null : (
                <span className="inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Nota fiscal em processamento
                </span>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
