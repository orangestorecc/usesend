import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { db } from "~/server/db";
import { getServerAuthSession } from "~/server/auth";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-24 max-w-md rounded-lg border p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold">Não foi possível continuar</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

async function decide(formData: FormData) {
  "use server";

  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = formData.get("state") ? String(formData.get("state")) : "";
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const scope = formData.get("scope") ? String(formData.get("scope")) : null;
  const decision = String(formData.get("decision") ?? "");

  const client = await db.oAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    throw new Error("Cliente OAuth inválido ou redirect_uri não registrada.");
  }

  const url = new URL(redirectUri);

  if (decision !== "allow") {
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    redirect(url.toString());
  }

  const teamUser = await db.teamUser.findFirst({
    where: { userId: Number(session.user.id) },
    include: { team: true },
  });
  if (!teamUser) {
    throw new Error("Nenhum time encontrado para a sua conta.");
  }

  const code = randomBytes(32).toString("hex");
  await db.oAuthAuthCode.create({
    data: {
      code,
      clientId,
      redirectUri,
      codeChallenge,
      scope,
      userId: Number(session.user.id),
      teamId: teamUser.teamId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const responseType = str(sp.response_type);
  const clientId = str(sp.client_id);
  const redirectUri = str(sp.redirect_uri);
  const codeChallenge = str(sp.code_challenge);
  const codeChallengeMethod = str(sp.code_challenge_method);
  const state = str(sp.state);
  const scope = str(sp.scope);

  if (
    responseType !== "code" ||
    !clientId ||
    !redirectUri ||
    !codeChallenge ||
    codeChallengeMethod !== "S256"
  ) {
    return (
      <ErrorView message="Requisição OAuth inválida ou incompleta (é necessário PKCE S256)." />
    );
  }

  const client = await db.oAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return (
      <ErrorView message="Cliente OAuth desconhecido ou redirect_uri não registrada." />
    );
  }

  const session = await getServerAuthSession();
  if (!session?.user) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    if (state) params.set("state", state);
    if (scope) params.set("scope", scope);
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${params.toString()}`)}`);
  }

  const teamUser = await db.teamUser.findFirst({
    where: { userId: Number(session.user.id) },
    include: { team: true },
  });

  const appName = client.clientName || "Uma ferramenta de IA";

  return (
    <div className="mx-auto mt-20 max-w-md rounded-xl border p-8 shadow-sm">
      <div className="text-center">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Autorização
        </div>
        <h1 className="mt-1 text-xl font-bold">Conectar ao Madmail</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{appName}</span> quer
          acessar sua conta{teamUser ? (
            <>
              {" "}(time{" "}
              <span className="font-medium text-foreground">
                {teamUser.team.name}
              </span>
              )
            </>
          ) : null}{" "}
          para gerenciar contatos, templates, campanhas e enviar e-mails via MCP.
        </p>
      </div>

      <div className="mt-6 rounded-lg border bg-muted/20 p-4 text-sm">
        Conectado como{" "}
        <span className="font-medium">{session.user.email}</span>
      </div>

      <form className="mt-6 flex gap-3">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="scope" value={scope} />
        <button
          formAction={decide}
          name="decision"
          value="deny"
          className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Negar
        </button>
        <button
          formAction={decide}
          name="decision"
          value="allow"
          className="flex-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          disabled={!teamUser}
        >
          Autorizar
        </button>
      </form>

      {!teamUser ? (
        <p className="mt-3 text-center text-xs text-amber-600">
          Você precisa ter um time para autorizar. Crie um time primeiro.
        </p>
      ) : null}
    </div>
  );
}
