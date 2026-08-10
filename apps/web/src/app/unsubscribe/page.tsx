import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  getContactFromUnsubscribeLink,
  unsubscribeContactFromLink,
} from "~/server/service/campaign-service";
import { db } from "~/server/db";
import ReSubscribe from "./re-subscribe";
import UnsubscribeButton from "./unsubscribe-button";

export const dynamic = "force-dynamic";

const DEFAULT_THEME = {
  logoUrl: null as string | null,
  bgColor: "#05050A",
  textColor: "#EDEEF0",
  accentColor: "#363A3F",
  hideBranding: false,
  prefsTitle: "Deseja cancelar a inscrição?",
  prefsSubtitle: "Confirme suas preferências de e-mail:",
  unsubButtonLabel: "Cancelar inscrição",
  successTitle: "Suas preferências de e-mail foram atualizadas.",
};

type Theme = typeof DEFAULT_THEME;

async function getThemeForContactBook(
  contactBookId?: string | null,
): Promise<Theme> {
  if (!contactBookId) return DEFAULT_THEME;
  const book = await db.contactBook.findUnique({
    where: { id: contactBookId },
    select: { teamId: true },
  });
  if (!book) return DEFAULT_THEME;
  const s = await db.unsubscribePageSettings.findUnique({
    where: { teamId: book.teamId },
  });
  return s ? { ...DEFAULT_THEME, ...s } : DEFAULT_THEME;
}

const PUBLIC_UNSUBSCRIBE_ERRORS = new Set([
  "Invalid unsubscribe link",
  "Contact not found",
]);

function getUnsubscribeErrorMessage(error: unknown) {
  if (error instanceof Error && PUBLIC_UNSUBSCRIBE_ERRORS.has(error.message)) {
    return error.message;
  }

  return "Não foi possível cancelar a inscrição. Tente novamente.";
}

function buildUnsubscribeUrl({
  id,
  hash,
  status,
  error,
}: {
  id?: string;
  hash?: string;
  status?: "error";
  error?: string;
}) {
  const searchParams = new URLSearchParams();

  if (id) searchParams.set("id", id);
  if (hash) searchParams.set("hash", hash);
  if (status) searchParams.set("status", status);
  if (error) searchParams.set("error", error);

  const queryString = searchParams.toString();
  return queryString ? `/unsubscribe?${queryString}` : "/unsubscribe";
}

async function unsubscribeAction(formData: FormData) {
  "use server";

  const id = formData.get("id");
  const hash = formData.get("hash");

  if (typeof id !== "string" || typeof hash !== "string") {
    redirect(
      buildUnsubscribeUrl({
        status: "error",
        error: "Invalid unsubscribe link",
      }),
    );
  }

  let redirectUrl: string;

  try {
    await unsubscribeContactFromLink(id, hash);
    redirectUrl = buildUnsubscribeUrl({ id, hash });
  } catch (error) {
    redirectUrl = buildUnsubscribeUrl({
      id,
      hash,
      status: "error",
      error: getUnsubscribeErrorMessage(error),
    });
  }

  redirect(redirectUrl);
}

function MessageCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="w-full max-w-md space-y-4 rounded-xl border p-8 shadow">
      <h1 className="text-center text-2xl font-semibold">{title}</h1>
      <p className="text-center text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const getSingleValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const params = await searchParams;
  const id = getSingleValue(params.id);
  const hash = getSingleValue(params.hash);
  const status = getSingleValue(params.status);
  const error = getSingleValue(params.error);

  let content: ReactNode;
  let theme: Theme = DEFAULT_THEME;

  if (!id || !hash) {
    content = (
      <MessageCard
        title="Link inválido"
        message="Este link de cancelamento é inválido. Verifique a URL e tente novamente."
      />
    );
  } else {
    try {
      const contact = await getContactFromUnsubscribeLink(id, hash);
      theme = await getThemeForContactBook(contact.contactBookId);

      if (!contact.subscribed) {
        content = <ReSubscribe id={id} hash={hash} contact={contact} />;
      } else {
        content = (
          <div className="flex w-full max-w-lg flex-col items-center rounded-2xl px-8 py-14 text-center">
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.logoUrl}
                alt="Logo"
                className="mb-6 h-10 w-auto"
              />
            ) : null}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">{theme.prefsTitle}</h1>
              <p className="text-sm opacity-70">{theme.prefsSubtitle}</p>
              <p className="pt-1 text-xs opacity-60">{contact.email}</p>
            </div>

            {status === "error" ? (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {getUnsubscribeErrorMessage(error ? new Error(error) : null)}
              </p>
            ) : null}

            <form action={unsubscribeAction} className="mt-6 w-full max-w-xs">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="hash" value={hash} />
              <UnsubscribeButton
                label={theme.unsubButtonLabel}
                accentColor={theme.accentColor}
                textColor={theme.textColor}
              />
            </form>
          </div>
        );
      }
    } catch (linkError) {
      content = (
        <MessageCard
          title="Link inválido"
          message={getUnsubscribeErrorMessage(linkError)}
        />
      );
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ background: theme.bgColor, color: theme.textColor }}
    >
      {content}

      {!theme.hideBranding ? (
        <div className="mt-10 text-xs opacity-50">
          <p>
            Desenvolvido por{" "}
            <a href="https://madmail.com.br" className="font-semibold">
              Madmail
            </a>
          </p>
        </div>
      ) : null}
    </main>
  );
}
