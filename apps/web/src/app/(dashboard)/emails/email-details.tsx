"use client";

import { UAParser } from "ua-parser-js";
import { api } from "~/trpc/react";
import { EmailStatusBadge, EmailStatusIcon } from "./email-status-badge";
import { formatDate } from "date-fns";
import { motion } from "framer-motion";
import { EmailStatus } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";
import {
  SesBounce,
  SesClick,
  SesComplaint,
  SesDeliveryDelay,
  SesOpen,
} from "~/types/aws-types";
import {
  BOUNCE_ERROR_MESSAGES,
  COMPLAINT_ERROR_MESSAGES,
  DELIVERY_DELAY_ERRORS,
} from "@usesend/lib/src/constants/ses-errors";
import CancelEmail from "./cancel-email";
import { useEffect, useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@usesend/ui/src/tabs";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type EmailData = RouterOutputs["email"]["getEmail"];

export default function EmailDetails({ emailId }: { emailId: string }) {
  const emailQuery = api.email.getEmail.useQuery({ id: emailId });
  const email = emailQuery.data;

  const isScheduled = email?.latestStatus === "SCHEDULED";
  const to = (email?.to ?? []).join(", ");
  const replyTo = (email?.replyTo ?? []).join(", ");
  const cc = (email?.cc ?? []).join(", ");
  const bcc = (email?.bcc ?? []).join(", ");

  return (
    <div className="h-full overflow-auto px-4 no-scrollbar">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/30">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            E-mail
          </div>
          <h1 className="break-all text-lg font-bold">{to}</h1>
        </div>
      </div>

      {/* Grid de campos */}
      <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label="De" value={email?.from} />
        <Field label="Assunto">
          <span className="inline-flex items-center gap-1.5 text-sm break-all">
            {email?.subject}
            {email?.latestStatus === "DELIVERED" ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : null}
          </span>
        </Field>
        <Field label="Para" value={to} />
        <CopyField label="ID" value={email?.id} />
        {replyTo ? <Field label="Reply-To" value={replyTo} /> : null}
        {cc ? <Field label="CC" value={cc} /> : null}
        {bcc ? <Field label="BCC" value={bcc} /> : null}
        <Field label="Log">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            POST /emails
          </code>
        </Field>
        <Field label="Status">
          <EmailStatusBadge status={email?.latestStatus ?? "SENT"} />
        </Field>
      </div>

      {/* Agendamento */}
      {isScheduled && email?.scheduledAt ? (
        <div className="mt-6 flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3">
          <span className="text-sm text-muted-foreground">Agendado para</span>
          <span className="text-sm">
            {formatDate(email.scheduledAt, "dd/MM/yyyy 'às' HH:mm")}
          </span>
          <div className="ml-auto">
            <CancelEmail emailId={emailId} />
          </div>
        </div>
      ) : null}

      {/* Histórico de eventos */}
      {!isScheduled && email?.emailEvents?.length ? (
        <div className="mt-8">
          <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico de eventos
          </div>
          <div className="rounded-lg border bg-muted/10 p-6 shadow-sm">
            <div className="flex items-stretch px-2">
              <div className="border-r border-dashed border-gray-300 dark:border-gray-700" />
              <div className="flex w-full flex-col gap-10">
                {email.emailEvents.map((evt) => (
                  <div
                    key={evt.status}
                    className="flex w-full items-start gap-5"
                  >
                    <div className="-ml-2.5">
                      <EmailStatusIcon status={evt.status} />
                    </div>
                    <div className="-mt-[0.125rem] w-full">
                      <EmailStatusBadge status={evt.status} />
                      <div className="mt-2 text-xs text-muted-foreground">
                        {formatDate(evt.createdAt, "dd/MM/yyyy 'às' HH:mm")}
                      </div>
                      <div className="mt-1 text-foreground/80">
                        <EmailStatusText status={evt.status} data={evt.data} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Preview com abas */}
      <div className="mb-4 mt-8">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conteúdo
        </div>
        <div className="rounded-lg border shadow-sm">
          <Tabs defaultValue="preview">
            <div className="border-b px-2 pt-2">
              <TabsList className="bg-transparent">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="text">Texto</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="m-0">
              <EmailPreview html={email?.html ?? ""} />
            </TabsContent>

            <TabsContent value="text" className="m-0">
              <CodeBlock
                content={email?.text || "Sem versão em texto puro."}
              />
            </TabsContent>

            <TabsContent value="html" className="m-0">
              <CodeBlock content={email?.html || "Sem conteúdo HTML."} />
            </TabsContent>

            <TabsContent value="raw" className="m-0">
              <CodeBlock content={buildRaw(email ?? null)} />
            </TabsContent>

            <TabsContent value="insights" className="m-0">
              <Insights html={email?.html ?? ""} text={email?.text ?? ""} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Campos --------------------------------- */

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children ?? (
        <span className="break-all text-sm">{value ?? "—"}</span>
      )}
    </div>
  );
}

function CopyField({ label, value }: { label: string; value?: string | null }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <button
        onClick={copy}
        className="group flex items-center gap-2 rounded bg-muted px-2 py-1 text-left"
      >
        <span className="truncate font-mono text-xs">{value ?? "—"}</span>
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
        )}
      </button>
    </div>
  );
}

/* --------------------------------- Preview -------------------------------- */

const EmailPreview = ({ html }: { html: string }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-[420px] overflow-auto rounded-b-lg bg-slate-100 p-6 dark:bg-slate-200">
      {show ? (
        <iframe
          className="mx-auto h-full w-full max-w-2xl rounded bg-white shadow-sm"
          srcDoc={html}
          sandbox="allow-same-origin"
        />
      ) : null}
    </div>
  );
};

const CodeBlock = ({ content }: { content: string }) => (
  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-all rounded-b-lg bg-muted/30 p-4 font-mono text-xs leading-relaxed">
    {content}
  </pre>
);

function buildRaw(email: EmailData): string {
  if (!email) return "—";
  const lines = [
    `From: ${email.from ?? ""}`,
    `To: ${(email.to ?? []).join(", ")}`,
    email.replyTo?.length ? `Reply-To: ${email.replyTo.join(", ")}` : null,
    email.cc?.length ? `Cc: ${email.cc.join(", ")}` : null,
    email.bcc?.length ? `Bcc: ${email.bcc.join(", ")}` : null,
    `Subject: ${email.subject ?? ""}`,
    email.sesEmailId ? `Message-ID: ${email.sesEmailId}` : null,
    email.headers ? `\n${email.headers}` : null,
    "",
    email.text || "(sem corpo em texto)",
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}

const Insights = ({ html, text }: { html: string; text: string }) => {
  const linkCount = (html.match(/<a\s/gi) ?? []).length;
  const imgCount = (html.match(/<img\s/gi) ?? []).length;
  const htmlSizeKb = (new Blob([html]).size / 1024).toFixed(1);

  const rows: { label: string; value: string }[] = [
    { label: "Links no conteúdo", value: String(linkCount) },
    { label: "Imagens no conteúdo", value: String(imgCount) },
    { label: "Tamanho do HTML", value: `${htmlSizeKb} KB` },
    {
      label: "Versão em texto puro",
      value: text ? "Presente" : "Ausente",
    },
  ];

  return (
    <div className="rounded-b-lg p-4">
      <div className="grid grid-cols-2 gap-4">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-lg border bg-muted/20 px-4 py-3"
          >
            <div className="text-xs text-muted-foreground">{r.label}</div>
            <div className="mt-1 text-lg font-semibold">{r.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Insights básicos derivados do conteúdo. Métricas avançadas de
        entregabilidade/spam serão adicionadas em seguida.
      </p>
    </div>
  );
};

/* ------------------------------ Texto por status --------------------------- */

const EmailStatusText = ({
  status,
  data,
}: {
  status: EmailStatus;
  data: JsonValue;
}) => {
  if (status === "SENT") {
    return (
      <div>
        Recebemos sua solicitação e enviamos o e-mail para o servidor do
        destinatário.
      </div>
    );
  } else if (status === "DELIVERED") {
    return <div>O e-mail foi entregue com sucesso ao destinatário.</div>;
  } else if (status === "DELIVERY_DELAYED") {
    const _errorData = data as unknown as SesDeliveryDelay;
    const errorMessage = DELIVERY_DELAY_ERRORS[_errorData.delayType];

    return <div>{errorMessage}</div>;
  } else if (status === "BOUNCED") {
    const _errorData = data as unknown as SesBounce;
    _errorData.bounceType;

    return (
      <div className="flex w-full flex-col gap-4">
        <p>{getErrorMessage(_errorData)}</p>
        <div className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4">
          <div className="flex w-full gap-2">
            <div className="w-1/2">
              <p className="text-sm text-muted-foreground">Tipo</p>
              <p>{_errorData.bounceType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Subtipo</p>
              <p>{_errorData.bounceSubType}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Resposta SMTP</p>
            <p>{_errorData.bouncedRecipients[0]?.diagnosticCode}</p>
          </div>
        </div>
      </div>
    );
  } else if (status === "FAILED") {
    const _errorData = data as unknown as { error: string };
    return <div>{_errorData.error}</div>;
  } else if (status === "OPENED") {
    const _data = data as unknown as SesOpen;
    const userAgent = getUserAgent(_data.userAgent);

    return (
      <div className="mt-4 w-full rounded-xl bg-muted/30 p-4">
        <div className="flex w-full">
          {userAgent.os.name ? (
            <div className="w-1/2">
              <p className="text-sm text-muted-foreground">SO</p>
              <p>{userAgent.os.name}</p>
            </div>
          ) : null}
          {userAgent.browser.name ? (
            <div>
              <p className="text-sm text-muted-foreground">Navegador</p>
              <p>{userAgent.browser.name}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  } else if (status === "CLICKED") {
    const _data = data as unknown as SesClick;
    const userAgent = getUserAgent(_data.userAgent);

    return (
      <div className="mt-4 flex w-full flex-col gap-4 rounded-xl bg-muted/30 p-4">
        <div className="flex w-full">
          {userAgent.os.name ? (
            <div className="w-1/2">
              <p className="text-sm text-muted-foreground">SO </p>
              <p>{userAgent.os.name}</p>
            </div>
          ) : null}
          {userAgent.browser.name ? (
            <div>
              <p className="text-sm text-muted-foreground">Navegador </p>
              <p>{userAgent.browser.name}</p>
            </div>
          ) : null}
        </div>
        <div className="w-full">
          <p className="text-sm text-muted-foreground">URL</p>
          <p>{_data.link}</p>
        </div>
      </div>
    );
  } else if (status === "COMPLAINED") {
    const _errorData = data as unknown as SesComplaint;

    return (
      <div className="flex w-full flex-col gap-4">
        <p>{getComplaintMessage(_errorData.complaintFeedbackType)}</p>
      </div>
    );
  } else if (status === "CANCELLED") {
    return <div>Este e-mail agendado foi cancelado</div>;
  } else if (status === "SUPPRESSED") {
    return (
      <div>
        Este e-mail foi suprimido porque anteriormente ele retornou (bounce) ou
        o destinatário registrou uma reclamação.
      </div>
    );
  }

  return <div className="w-full">{status}</div>;
};

const getErrorMessage = (data: SesBounce) => {
  if (data.bounceType === "Permanent") {
    return BOUNCE_ERROR_MESSAGES[data.bounceType][
      data.bounceSubType as
        | "General"
        | "NoEmail"
        | "Suppressed"
        | "OnAccountSuppressionList"
    ];
  } else if (data.bounceType === "Transient") {
    return BOUNCE_ERROR_MESSAGES[data.bounceType][
      data.bounceSubType as
        | "General"
        | "MailboxFull"
        | "MessageTooLarge"
        | "ContentRejected"
        | "AttachmentRejected"
    ];
  } else if (data.bounceType === "Undetermined") {
    return BOUNCE_ERROR_MESSAGES.Undetermined;
  }
};

const getComplaintMessage = (errorType: string) => {
  return COMPLAINT_ERROR_MESSAGES[
    errorType as keyof typeof COMPLAINT_ERROR_MESSAGES
  ];
};

const getUserAgent = (userAgent: string) => {
  const parser = new UAParser(userAgent);
  return {
    browser: parser.getBrowser(),
    os: parser.getOS(),
    device: parser.getDevice(),
  };
};
