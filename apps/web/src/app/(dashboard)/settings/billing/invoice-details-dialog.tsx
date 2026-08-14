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

  // Faturas emitidas antes do detalhamento não têm subtotal gravado: nesse caso
  // o próprio total é a única verdade que temos, e a conta fecha trivialmente.
  const subtotal = fatura?.subtotalCents ?? fatura?.amountCents ?? 0;
  const contaFecha =
    !fatura ||
    subtotal -
      fatura.discountCents +
      fatura.overageCents +
      fatura.surchargeCents ===
      fatura.amountCents;

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
              <Linha rotulo="Plano">
                {fatura.planName ?? fatura.description ?? "Assinatura"}
              </Linha>
              {fatura.planName && fatura.description ? (
                <Linha rotulo="Descrição">{fatura.description}</Linha>
              ) : null}
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

            {/* Memória de cálculo: de onde saiu cada centavo. */}
            <div className="py-2">
              <Linha rotulo="Valor do plano">
                <span className="font-mono">{brl(subtotal)}</span>
              </Linha>

              {fatura.discountCents > 0 ? (
                <Linha
                  rotulo={
                    fatura.promoCode
                      ? `Cupom ${fatura.promoCode}${
                          fatura.promoLabel ? ` (${fatura.promoLabel})` : ""
                        }`
                      : "Desconto"
                  }
                >
                  <span className="font-mono text-emerald-600">
                    − {brl(fatura.discountCents)}
                  </span>
                </Linha>
              ) : null}

              {/* Extras do ciclo anterior. A frase do `overageDetail` é a única
                  explicação que sobra depois que o mês vira — sem ela o cliente
                  vê uma linha a mais na fatura e nenhuma justificativa. */}
              {fatura.overageCents > 0 ? (
                <Linha rotulo="Extras do ciclo">
                  <span className="font-mono">+ {brl(fatura.overageCents)}</span>
                  {fatura.overageDetail ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {fatura.overageDetail}
                    </span>
                  ) : null}
                </Linha>
              ) : null}

              {fatura.surchargeCents > 0 ? (
                <Linha
                  rotulo={`Juros do parcelamento${
                    fatura.installments ? ` (${fatura.installments}x)` : ""
                  }`}
                >
                  <span className="font-mono">+ {brl(fatura.surchargeCents)}</span>
                </Linha>
              ) : null}

              <div className="mt-1 flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="font-mono">{brl(fatura.amountCents)}</span>
              </div>

              {fatura.installments && fatura.installments > 1 ? (
                <p className="pt-1 text-right text-xs text-muted-foreground">
                  {fatura.installments}x de{" "}
                  {brl(Math.round(fatura.amountCents / fatura.installments))}
                </p>
              ) : null}

              {/* Só aparece se a conta não fechar — é bug nosso, não do cliente,
                  e é melhor ele ver o aviso do que sair somando errado. */}
              {contaFecha ? null : (
                <p className="pt-2 text-xs text-muted-foreground">
                  Esta fatura é anterior ao detalhamento por item; o total
                  cobrado é o valor acima.
                </p>
              )}
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
