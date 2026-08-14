import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { db } from "~/server/db";
import { getServerAuthSession } from "~/server/auth";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * Apps que a gente conhece. Não é allowlist de bloqueio — é só o que separa
 * "isso é o ChatGPT mesmo" de "isso é alguém se passando pelo ChatGPT" na tela.
 */
const HOSTS_CONHECIDOS = [
  "claude.ai",
  "anthropic.com",
  "chatgpt.com",
  "openai.com",
  "cursor.com",
  "cursor.sh",
  "windsurf.com",
  "codeium.com",
  "github.com",
  "vscode.dev",
];

/**
 * Destino do código, como o usuário precisa vê-lo. Inclui o caminho de
 * propósito: um app conhecido pode ter um redirecionador aberto, e mostrar só
 * o host esconderia exatamente esse caso.
 */
function destinoDe(uri: string): { host: string; completo: string } {
  try {
    const u = new URL(uri);
    const completo = `${u.host}${u.pathname}${u.search ? "?…" : ""}`;
    return { host: u.host, completo };
  } catch {
    return { host: uri, completo: uri };
  }
}

function ehConhecido(host: string): boolean {
  const semPorta = host.split(":")[0] ?? "";
  return HOSTS_CONHECIDOS.some(
    (h) => semPorta === h || semPorta.endsWith(`.${h}`),
  );
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
  const decision = String(formData.get("decision") ?? "");

  // O escopo gravado aqui é o que o usuário realmente marcou na tela — é ele
  // que o /api/oauth/token lê para decidir se a chave pode disparar e-mail.
  const podeEnviar = formData.get("allow_send") === "on";
  const scope = podeEnviar ? "mcp mcp:send" : "mcp";

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
      <ErrorView message="Esse pedido de acesso chegou incompleto. Volte ao seu aplicativo de IA e tente adicionar o Madmail de novo." />
    );
  }

  const client = await db.oAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return (
      <ErrorView message="Não reconhecemos o programa que está pedindo acesso. Remova a conexão no seu aplicativo de IA e adicione o Madmail de novo." />
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

  // O nome vem do próprio app que está pedindo acesso — qualquer um pode
  // escolher o seu. Por isso ele aparece entre aspas, e quem manda na tela é o
  // endereço de destino logo abaixo.
  const appName = client.clientName || "Um programa";
  const destino = destinoDe(redirectUri);
  const conhecido = ehConhecido(destino.host);

  return (
    <div className="mx-auto mt-20 max-w-md rounded-xl border p-8 shadow-sm">
      <div className="text-center">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Pedido de acesso
        </div>
        <h1 className="mt-1 text-xl font-bold">
          Um programa quer entrar na sua conta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ele se apresenta como “{appName}”
          {teamUser ? (
            <>
              {" "}e quer mexer na conta{" "}
              <span className="font-medium text-foreground">
                {teamUser.team.name}
              </span>
            </>
          ) : null}
          .
        </p>
      </div>

      {/* O que decide se isso é legítimo: para onde o acesso vai. */}
      <div
        className={`mt-6 rounded-lg border p-4 text-sm ${
          conhecido ? "bg-muted/20" : "border-amber-500/50 bg-amber-500/10"
        }`}
      >
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          O acesso vai para
        </div>
        <div className="mt-1 break-all font-mono font-medium">
          {destino.completo}
        </div>
        <p className="mt-2 text-muted-foreground">
          Confira se é o mesmo programa que você está usando agora.
        </p>
        {conhecido ? null : (
          <p className="mt-1 text-amber-700 dark:text-amber-500">
            Não conhecemos esse endereço. Se ele não é o do programa que você
            abriu, clique em <strong>Não permitir</strong>.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm">
        <div className="font-medium">O que ele vai poder fazer</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong>ler a sua base de contatos inteira</strong>, e alterar
            contatos e listas
          </li>
          <li>criar e alterar modelos de e-mail e campanhas</li>
          <li>ver seus relatórios de entrega e a saúde dos envios</li>
          <li>
            ao adicionar contatos numa lista com confirmação, disparar o e-mail
            de confirmação para eles
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Ele não consegue trocar sua senha, ver dados de pagamento nem apagar
          sua conta.
        </p>
      </div>

      <form className="mt-4">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <input type="hidden" name="state" value={state} />

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm">
          <input
            type="checkbox"
            name="allow_send"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <span className="font-medium">
              Também deixar que ele envie e-mail de verdade
            </span>
            <span className="mt-1 block text-muted-foreground">
              Sem marcar, ele monta e agenda campanhas, mas quem aperta enviar é
              você. E-mail enviado não volta. (A exceção é o e-mail de
              confirmação acima, que sai junto com a inclusão do contato.)
            </span>
          </span>
        </label>

        <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm">
          Entrando como{" "}
          <span className="font-medium">{session.user.email}</span>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            formAction={decide}
            name="decision"
            value="deny"
            className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Não permitir
          </button>
          <button
            formAction={decide}
            name="decision"
            value="allow"
            className="flex-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            disabled={!teamUser}
          >
            Permitir
          </button>
        </div>
      </form>

      {!teamUser ? (
        <p className="mt-3 text-center text-xs text-amber-600">
          Sua conta ainda não está ligada a nenhuma empresa. Crie uma no painel
          do Madmail e volte aqui.
        </p>
      ) : null}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Dá para desfazer quando quiser, em Integrações → Assistente de IA.
      </p>
    </div>
  );
}
